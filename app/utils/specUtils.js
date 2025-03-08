/*
Copyright (c) 2025, FNLCR - All rights reserved.
*/
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
let regexPathArr = [];
//javascript to check URL against openapi spec paths
//create an array of paths regex 
function buildPathRegex() {
  try {
    // Synchronicity used
    const data = fs.readFileSync(path.resolve(__dirname, '..', '..','swagger-aggr.yml'), 'utf8');
    //swagger file is located in 2 level back of the current folder
    const parsedData = yaml.load(data);
    //console.debug("parsedDataPath",parsedData.paths);
    for (const path in parsedData.paths) {
      //console.debug("parsedDataPath: ", path);
      const openApiPathPattern = path.replace(/\{([^}]+)\}/g, '([^/]+)');
      const regexPath = new RegExp('^\/api\/v[0-9]+' + openApiPathPattern + '$');
      regexPathArr.push(regexPath);
    }
  } catch (e) {
    console.error("error reading swagger-aggr.yml", "the server will not function", e);
  }
  if (regexPathArr.length <= 0) {
  	console.error("error parsing spec file swagger-aggr.yml", "API endpoints were not found in the spec");
  }
}
function matchPathToOpenApi(pathname) {
  for (const pathRegex of regexPathArr) {
    if (pathRegex.test(pathname)) {
      return true;
     }
  }
  console.error("error invalid path", pathname);
  return false;
}

module.exports = {
	buildPathRegex,
	matchPathToOpenApi
}