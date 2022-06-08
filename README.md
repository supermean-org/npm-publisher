# Publish

GitHub Action to release projects and publish packages

## Inputs

### `github_token`

`string`

Required. GitHub Token from action context

### `npm_token`

`string`

Optional. If not provided, publishing to npm will be skipped.
NPM token with publish permission.

### `discord_webhook`

Optional. Discord chat notification webhook url.

### `gchat_webhook`

Optional. Google chat notification webhook url.

### `access`

`string`

Optional. Npm access flag. Default is public.

## Usage Example

````yaml
name: Publish
jobs:
  deploy:
    name: Package
    steps:
      - uses: actions/checkout@v3
      # your stuff
      - uses: mean-dao/npm-publish-toolkit@v1
        with:
          github_token: ${{ github.token }}
          npm_token: ${{ secrets.NPM_TOKEN }}
          discord_webhook: ${{ secrets.DISCORD_WEBHOOK }}
          gchat_webhook: ${{ secrets.GOOGLE_CHAT_WEBHOOK }}
````

