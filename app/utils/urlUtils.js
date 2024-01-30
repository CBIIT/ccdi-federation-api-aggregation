const startApiUrl = "/api/v0/";
const arrayEndpoints = ["subject", "sample", "file", "info", "metadata"];
const mapSources = new Map([["pedscommons", "UChicago"], ["stjude", "StJude"], ["ucsc", "UCSC"], ["chop", "CHOP"]]);
// TODO read above endpoints from YAML

const validEndpointStart = arrayEndpoints.map(i => startApiUrl + i);
module.exports = {
    getDomain: function (strHostName) {

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
    },
    concatArray: function (res) {
       let s= '';
       if(!Array.isArray(res)) return res;
       if(res.length < 1) return '[]';
       let prefix= '[';
       res.forEach(function(x) {s+= prefix+x; prefix= ',';});
       s+= ']';
       return s;
    },
    validEndpoint: function (str) {
        // returns true if str starts with "/api/v0/<endpoint>"
        let resValid = false;
        console.log(arrayEndpoints.join("|"));
        if (str != null) {
            if (str.startsWith(startApiUrl)) {
                if (new RegExp(validEndpointStart.join("|")).test(str)) {
                    resValid = true;
                }
            }
        }
        return resValid;
    },
    addSourceAttr: function (strJson, options) {
        strJson = strJson.trimStart();
        //aggregation adds "source" attribute to all entries which are not arrays
        //source values are searched based on domains
        if (strJson.startsWith ('{')) {
            //add source to counts and summaries
            let strHost = options.host;
            let strSource = "";
            for (var entry of mapSources.entries()) {
                if (strHost.includes(entry[0])) {
                    strSource = entry[1];
                    break;
                }
            }
            if (strSource.length > 0) {
                //resultJson["source"] = strSource;
                return ('{"source":"' + strSource + '",\n ' + strJson.slice(1));
            }
            else 
                return strJson;
        }
        else {
            console.log("addSourceAttr", typeof(resultJson), resultJson);
            return strJson;
        }
    }
};
