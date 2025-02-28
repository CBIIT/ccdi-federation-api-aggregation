/*
Copyright (c) 2025, FNLCR - All rights reserved.
*/
const startApiUrl = "/api/v";//we do not validate the version
const arrayEndpoints = ["subject", "sample", "file", "info", "metadata","namespace","organization"];
//const mapSources = new Map([["pedscommons", "UChicago"], ["stjude", "StJude"], ["ucsc", "UCSC"], ["kidsfirst", "CHOP"]]);
const mapSources = new Map([["pedscommons", "PCDC"], ["stjude", "StJude"], ["ucsc", "Treehouse"], ["kidsfirst", "KidsFirst"]]);
// TODO read above endpoints from YAML
let errTemplate404 = '{"errors": [{"kind": "InvalidRoute", "method": "GET", "route": "/api", "message":"The requested URL was not found."}]}';
let errTemplateTimeout = '{"errors": [{"kind": "NotFound", "method": "GET", "route": "/api", "message":"Request Timeout."}]}';
let errTemplateServer500 = '{"errors": [{"kind": "NotFound", "method": "GET", "route": "/api", "message":"Server Error."}]}';

//const validEndpointStart = arrayEndpoints.map(i => startApiUrl + i);//this to create URL beginnings with startApiUrl
function getDomain (strHostName) {

    var domain = strHostName;

    if (strHostName != null) {
        var parts = strHostName.split('.').reverse();
        if (parts != null && parts.length > 3) {
            domain = parts[2] + '.'+ parts[1] + '.' + parts[0];
        }
        else if (parts != null && parts.length > 1) {
            domain = parts[1] + '.' + parts[0];
        }
    }
    
    return domain;
}
//older version
// function validEndpoint (str) {
//     // heuristic: returns true if str starts with "/api/v" and contains an expected <endpoint>
//     let resValid = false;
//     if (str != null) {
//         if (str.startsWith(startApiUrl)) {
//             if (new RegExp(arrayEndpoints.join("|")).test(str)) {
//                 resValid = true;
//             }
//         }
//     }
//     return resValid;
// }
function validEndpoint(str){
    return [
        /^\/api\/v[0-9]+\/subject/,
        /^\/api\/v[0-9]+\/sample/,
        /^\/api\/v[0-9]+\/file/,
        /^\/api\/v[0-9]+\/organization/,
        /^\/api\/v[0-9]+\/info/,
        /^\/api\/v[0-9]+\/namespace/,
        /^\/api\/v[0-9]+\/metadata/
    ].some(function(regexp){
        return regexp.test(str);
    });
}
function concatArray(res) {
    //res expected is an object array of arrays
    let s= '';
    if(!Array.isArray(res)) return res;
    //console.log("debug", "concatArray", ''+res.length);
    if(res.length < 1) return '[]';
    let prefix= '[';
    res.forEach(function(x) {s+= prefix+x; prefix= ',';});
    s+= ']';
    return s;
}
function findRequestSource(strHost) {
    let strSource = strHost;
    for (var entry of mapSources.entries()) {
        if (strHost.includes(entry[0])) {
            strSource = entry[1];
            break;
        }
    }
    return strSource;
}
function addSourceAttr(strJson, options, urlPath=startApiUrl) {
    strJson = strJson.trimStart();
    console.log("info", '"response received"', "server="+options.host, urlPath);
    //aggregation adds "source" attribute to all entries which are not arrays
    //source values are searched based on domains
    if (strJson.startsWith ('{')) {
        //add source to counts and summaries
        let strHost = options.host;
        let strSource = findRequestSource(strHost);//if source not found use host
        //resultJson["source"] = strSource;
        return ('{"source":"' + strSource + '",\n ' + strJson.slice(1));
    }
    else if ((!strJson) || (strJson === "")) {
        console.log("info", "server="+options.host, '"addSourceAttr empty parameter strJson"');
        let strSource = findRequestSource(options.host);//if source not found use host
        return ('{"source":"' + strSource+ '"}\n');
    }
    else {
        //console.log("debug", options.host, "addSourceAttr not added to strJson of type ", typeof(strJson), '"' + strJson + '"');
        return strJson;
    }
}
function getErrorStr404(strUrl) {
	//returns 404 error string
	var obj404 = JSON.parse(errTemplate404);
	//obj404.errors[0].route = strUrl;
	return JSON.stringify(obj404);
}
function getErrorStr500(strUrl) {
	//returns server error error string
	var objErr = JSON.parse(errTemplateServer500);
	console.error("error", '"resource receivd HTTP response 500"', "endpoint="+strUrl);
	//objErr.errors[0].route = strUrl;
	return JSON.stringify(objErr);
}
function getErrorStrTimeout(strUrl) {
	//returns timeout error string
	var objTimeout = JSON.parse(errTemplateTimeout);
	console.error("error", '"resource received HTTP request timeout"', "endpoint="+strUrl);
	//objTimeout.errors[0].route = strUrl;
	return JSON.stringify(objTimeout);
}
//keys are URLs, values are source. We assume here that both parameters are arrays
function mapHostToSource(keys, values) { 
    const mapSources = new Map();
    if (! keys) {
        console.error("error", "API domain URLs are not defined.");
        return mapSources;
    }
    if (! values) {
        console.error("error", "Define API sources!!!");
        //using findRequestSource from v.1.0.0
        for (let i = 0; i < keys.length; i++) {
            if (i < values.length) {
                mapSources.set(keys[i], findRequestSource(keys[i]));
            }
        }
    }
    else {
        if (keys.length !== values.length) {
        console.error("error", "URL and Sources arrays are not the same length");
        }

        for (let i = 0; i < keys.length; i++) {
            if (i < values.length) {
                mapSources.set(keys[i], values[i]);
            }
            else {//use the key as a value
                mapSources.set(keys[i], keys[i]);
            }
        }
    }
    console.info("info", "Hosts to Sources", mapSources);
    return mapSources;
}
module.exports = {
    getDomain ,
    concatArray,
    validEndpoint,
    mapHostToSource, 
    addSourceAttr,
    getErrorStr404,
    getErrorStrTimeout,
    getErrorStr500
};
