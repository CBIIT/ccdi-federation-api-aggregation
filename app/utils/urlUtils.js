const startApiUrl = "/api/v0/";
const arrayEndpoints = ["subject", "sample", "file", "info", "metadata","namespace"];
const mapSources = new Map([["pedscommons", "UChicago"], ["stjude", "StJude"], ["ucsc", "UCSC"], ["chop", "CHOP"]]);
// TODO read above endpoints from YAML

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
    else {
        console.log("addSourceAttr", typeof(resultJson), resultJson);
        return strJson;
    }
}
module.exports = {
    getDomain ,
    concatArray,
    validEndpoint,
    findRequestSource,
    addSourceAttr
};
