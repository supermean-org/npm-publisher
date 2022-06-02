const version = 'v1.0.0';
const isProductVersion = version.match(/^v([0-9]|[1-9][0-9]*)\.([0-9]|[1-9][0-9]*)\.([0-9]|[1-9][0-9]*)$/gm);
const isPrerelease = isProductVersion === null;

console.log(`isProductVersion: ${isProductVersion}, isPrerelease: ${isPrerelease}, isPrerelease: ${!!isPrerelease}`);