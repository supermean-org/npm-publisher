const util = require('util');
const axios = require("axios");
const fse = require('fs-extra');
const core = require('@actions/core');
const github = require('@actions/github');
const changelogParser = require('changelog-parser');
const npmFetch = require('npm-registry-fetch');
const npmPublish = require('@jsdevtools/npm-publish');

const fetchNpmVersions = async (packageName, token) => {
    const { versions } = await npmFetch.json(
        `http://registry.npmjs.org/${packageName}`,
        { token });
    const list = Object.values(versions).map(({ version }) => String(version));
    return list;
};

const parseChangelog = util.promisify(changelogParser);

async function run() {
    try {
        const github_token = core.getInput('github_token', { required: true });
        const gchat_webhook = core.getInput('gchat_webhook');
        const npm_token = core.getInput('npm_token');
        const access = core.getInput('access');
        const octokit = github.getOctokit(github_token);

        const path = `.`;
        const pathToPackage = `${path}/package.json`;

        const pkg = await fse.readJSON(pathToPackage);
        if (!pkg) {
            throw Error(`${pathToPackage} is missing`);
        }

        const name = pkg.name;
        if (!name) {
            throw Error(`Name in ${pathToPackage} is missing`);
        }

        const version = pkg.version;
        if (!version) {
            throw Error(`Version in ${pathToPackage} is missing`);
        }

        const tag = `v${version}`;

        core.info(`\nChecking ${tag}`);

        const owner = github.context.repo.owner;
        const repo = github.context.repo.repo;

        let npmPublishTag = '';
        let tagResponse = { data: {} };
        try {
            core.info(`Getting release tag ${tag}..`);
            tagResponse = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
                owner,
                repo,
                tag,
            });
        } catch (err) {
            core.info(`tagResponse:error:`, err);
        }

        let previousVersion = '';
        try {
            core.info(`Getting last tag..`);
            const tagList = await octokit.request('GET /repos/{owner}/{repo}/tags', {
                owner,
                repo,
            });

            previousVersion = tagList.data.filter(x => x.name !== tag)[0].name

            core.info(`previousVersion: ${previousVersion}`);
        } catch (err) {
            core.info(`previousVersion:error:`, err);
        }

        let commits = [];
        try {
            core.info(`Getting last tag..`);
            const commitList = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
                owner,
                repo,
                basehead: `${previousVersion}...HEAD`
            });

            commits = commitList.data.commits.map(x => `[${x.commit.author.name}] ${x.commit.message}`);

            core.info(`commits:`, commits);
        } catch (err) {
            core.info(`commits:error:`, err);
        }

        const canRelease = !tagResponse.data.tag_name;
        const isProductVersion = version.match(/^v([0-9]|[1-9][0-9]*)\.([0-9]|[1-9][0-9]*)\.([0-9]|[1-9][0-9]*)$/gm);
        const isPrerelease = !isProductVersion;
        if (!isProductVersion) {
            npmPublishTag = 'alpha';
            if (version.match(/beta|rc/)) {
                npmPublishTag = 'beta';
            }
        }

        let notificationMsg = {
            packageName: name
        }

        if (canRelease) {
            let releaseNotes = { body: `Publish version ${tag}\n` };
            const changelogPath = `${path}/CHANGELOG.md`;
            if (fse.existsSync(changelogPath)) {
                const changelog = await parseChangelog(changelogPath);
                releaseNotes = changelog.versions[0];
            }

            if (commits.length > 0) {
                releaseNotes.body += '### Commits\n';
                releaseNotes.body += commits.map(x => `- ${x}`).join('\n');
            }

            await octokit.request('POST /repos/{owner}/{repo}/releases', {
                owner,
                repo,
                target_commitish: github.context.ref.split('refs/heads/')[1],
                tag_name: tag,
                name: tag,
                body: releaseNotes.body,
                prerelease: isPrerelease,
            });

            const githubReleaseUrl = `https://github.com/${owner}/${repo}/releases/tag/${tag}`;
            if (gchat_webhook) {
                notificationMsg = {
                    ...notificationMsg,
                    githubReleaseUrl
                };
            }
            core.info(`Release notes created: ${githubReleaseUrl}`);
        } else {
            core.info('Release is already exist. Nothing to do here');
        }

        if (npm_token) {
            let canPublish;
            try {
                const npmVersions = await fetchNpmVersions(name, npm_token);
                canPublish = !npmVersions.includes(version); // new version
            } catch {
                canPublish = true; // new package
            }

            if (canPublish) {
                await npmPublish.npmPublish({
                    token: npm_token,
                    access: access || 'public',
                    tag: npmPublishTag || 'latest'
                });

                const npmRegistyUrl = `https://www.npmjs.com/package/${name}`;
                if (gchat_webhook) {
                    notificationMsg = {
                        ...notificationMsg,
                        npmRegistyUrl
                    };
                }

                core.info(`Published to npm registry: ${npmRegistyUrl}`);
            } else {
                core.info('Package version is already exist. Nothing to do here');
            }

            if (gchat_webhook) {
                try {
                    core.info(`Sending notification...`);

                    let msg = `NEW VERSION RELEASED (${version})\n`;
                    Object.keys(notificationMsg).forEach(x => {
                        msg += `**${x}**: ${notificationMsg[x]}\n`
                    });
                    
                    await axios.default.post(gchat_webhook, { text: msg });

                    core.info(`Notification sent!`);
                } catch (error) {
                    core.info(`Webhook notification failed. Error: ${error}`)
                }
            }
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
