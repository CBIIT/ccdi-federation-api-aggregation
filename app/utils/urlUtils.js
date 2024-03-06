const startApiUrl = "/api/v0/";
const arrayEndpoints = ["subject", "sample", "file", "info", "metadata","namespace"];
const mapSources = new Map([["pedscommons", "UChicago"], ["stjude", "StJude"], ["ucsc", "UCSC"], ["chop", "CHOP"]]);
// TODO read above endpoints from YAML
let errTemplate404 = '{"errors": [{"kind": "InvalidRoute", "method": "GET", "route": ""}]}';
let errTemplateTimeout = '{"errors": [{"kind": "RequestTimeout", "method": "GET", "route": ""}]}';

const validEndpointStart = arrayEndpoints.map(i => startApiUrl + i);
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
function validEndpoint (str) {
    // returns true if str starts with "/api/v0/<endpoint>"
    let resValid = false;
    if (str != null) {
        if (str.startsWith(startApiUrl)) {
            if (new RegExp(validEndpointStart.join("|")).test(str)) {
                resValid = true;
            }
        }
    }
    return resValid;
}
function concatArray(res) {
    //res expected is an object array of arrays
    let s= '';
    if(!Array.isArray(res)) return res;
    //console.log("concatArray", ''+res.length);
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
function addSourceAttr(strJson, options) {
    strJson = strJson.trimStart();
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
        console.log("addSourceAttr empty parameter strJson");
        let strSource = findRequestSource(options.host);//if source not found use host
        return ('{"source":"' + strSource+ '}\n');
    }
    else {
        console.log("addSourceAttr not added to strJson of type ", typeof(strJson), '"' + strJson + '"');
        return strJson;
    }
}
function getErrorStr404(strUrl) {
	//returns 404 error string
	var obj404 = JSON.parse(errTemplate404);
	obj404.errors[0].route = strUrl;
	return JSON.stringify(obj404);
}
function getErrorStrTimeout(strUrl) {
	//returns timeout error string
	var objTimeout = JSON.parse(errTemplateTimeout);
	objTimeout.errors[0].route = strUrl;
	return JSON.stringify(objTimeout);
}
module.exports = {
    getDomain ,
    concatArray,
    validEndpoint,
    findRequestSource,
    addSourceAttr,
    getErrorStr404,
    getErrorStrTimeout
};
