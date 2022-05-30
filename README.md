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
      - uses: supermean-ayaz/publish@v4
        with:
          github_token: ${{ github.token }}
          npm_token: ${{ secrets.NPM_TOKEN }}
````

