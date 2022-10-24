require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 838:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 766:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ }),

/***/ 494:
/***/ ((module) => {

module.exports = eval("require")("@jsdevtools/npm-publish");


/***/ }),

/***/ 952:
/***/ ((module) => {

module.exports = eval("require")("axios");


/***/ }),

/***/ 696:
/***/ ((module) => {

module.exports = eval("require")("changelog-parser");


/***/ }),

/***/ 653:
/***/ ((module) => {

module.exports = eval("require")("fs-extra");


/***/ }),

/***/ 731:
/***/ ((module) => {

module.exports = eval("require")("npm-registry-fetch");


/***/ }),

/***/ 837:
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const util = __nccwpck_require__(837);
const axios = __nccwpck_require__(952);
const fse = __nccwpck_require__(653);
const core = __nccwpck_require__(838);
const github = __nccwpck_require__(766);
const changelogParser = __nccwpck_require__(696);
const npmFetch = __nccwpck_require__(731);
const npmPublish = __nccwpck_require__(494);

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
        const discord_webhook = core.getInput('discord_webhook');
        const gchat_webhook = core.getInput('gchat_webhook');
        const npm_token = core.getInput('npm_token');
        const access = core.getInput('access');
        const path = core.getInput('path') ?? `.`;
        const octokit = github.getOctokit(github_token);

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

            core.info(`commits: ${commits}`);
        } catch (err) {
            core.info(`commits:error:`, err);
        }

        const canRelease = !tagResponse.data.tag_name;
        const isProductionVersion = tag.match(/^v([0-9]|[1-9][0-9]*)\.([0-9]|[1-9][0-9]*)\.([0-9]|[1-9][0-9]*)$/gm);
        const isPrerelease = isProductionVersion === null;
        if (isPrerelease) {
            npmPublishTag = 'alpha';
            if (version.match(/beta|rc/)) {
                npmPublishTag = 'beta';
            }
        }

        core.info(`*** isProductionVersion: ${isProductionVersion}, isPrerelease: ${isPrerelease} ***`);

        let notificationMsg = {
            packageName: name,
            isPrerelease
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
            if (gchat_webhook || discord_webhook) {
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
                if (gchat_webhook || discord_webhook) {
                    notificationMsg = {
                        ...notificationMsg,
                        npmRegistyUrl
                    };
                }

                core.info(`Published to npm registry: ${npmRegistyUrl}`);
            } else {
                core.info('Package version is already exist. Nothing to do here');
            }

            if (gchat_webhook || discord_webhook) {
                try {
                    core.info(`Sending notification...`);

                    let msg = `*NEW VERSION RELEASED (${version})* \n`;
                    //developers.google.com/chat/api/guides/message-formats/basic#using_formatted_text_in_messages
                    Object.keys(notificationMsg).forEach(x => {
                        msg += `*${x}* : ${notificationMsg[x]} \n`
                    });

                    if (gchat_webhook) {
                        await axios.default.post(gchat_webhook, { text: msg });
                    }

                    if (discord_webhook) {
                        await axios.default.post(discord_webhook, { content: msg });
                    }

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

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map