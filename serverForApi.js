/*
Copyright (c) 2023, FNLCR - All rights reserved.
*/
const http = require("http");
const https = require("https");
const process = require("process");
const fs = require('fs');
const urlUtils = require("./app/utils/urlUtils");

//certificate loading is static as of now
const caTreehouse = [fs.readFileSync("./treehouse-cer.pem")];
const caPedscommons = [fs.readFileSync("./ccdifederation-pedscommons-org.pem")];
const caStjude = [fs.readFileSync("./ccdi-stjude-cloud.pem")];

var undefinedHost = "undefinedHost";
var optionsTreehouse = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 2000,
  rejectUnauthorized: false,
  ca: caTreehouse
};
var optionsPedscommons = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 2000,
  rejectUnauthorized: false,
  ca: caPedscommons
};
var optionsChop = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 3000
};
var optionsStjude = {
  host: undefinedHost,
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 2000,
  rejectUnauthorized: false,
  ca: caStjude
};
// hosts registration is static for now
// host are defined in env var federation_apis
// as comma-separated domains without protocol: www.server1.com, abc.server2.com, vfr.frh.server3.com
// expected are hosts from registered servers only
var apiHosts = process.env.federation_apis.split(",");
console.log(apiHosts ); //TODO remove log

for(var i = 0; i < apiHosts.length;i++){
  if (apiHosts[i].includes("pedscommons"))
    optionsPedscommons.host = apiHosts[i];
  else if (apiHosts[i].includes("stjude"))
    optionsStjude.host = apiHosts[i];    
  else if (apiHosts[i].includes("chop"))
    optionsChop.host = apiHosts[i];
  else if (apiHosts[i].includes("treehouse"))
    optionsTreehouse.host = apiHosts[i];
}

var regKidsFirst = new RegExp("Kid.*s.*First.*DRC");
var contentTypeJson = "application/json; charset=utf-8";

const server = http.createServer((req, res) => {
  const urlPath = req.url;
  console.log('Request with urlPath: ', urlPath);
  let isTreehouseUrl = urlPath.indexOf('treehouse') > 0;
  let isPedscommonsUrl = urlPath.indexOf('pedscommons') > 0;
  let isKidsFirstUrl = regKidsFirst.test(urlPath);
  let isStjudeUrl = urlPath.indexOf('stjude') > 0; //StJude not implemented
  console.log('isTreehouseUrl: ', isTreehouseUrl, 'isPedscommonsUrl: ', isPedscommonsUrl,
  'isKidsFirstUrl: ', isKidsFirstUrl, 'isStjudeUrl: ', isStjudeUrl);

  function responseLength(strResponse) {//expects a string parameter
    return Buffer.byteLength(strResponse, 'utf8') +'';
  }
  if (urlPath == "/welcome") {
    res.writeHead(200, {"Content-Type": "text/plain", "Content-Length":"42"});
    res.end('Welcome to CCDI Federation API Aggregation');
  } else if (isTreehouseUrl&&(optionsTreehouse.host !== undefinedHost)) {
      console.log("Treehouse request: ", urlPath);
      getresultHttp(optionsTreehouse, urlPath, https).then(data => {
      res.writeHead(200, { "Content-Type": contentTypeJson, "Content-Length":responseLength(data)});
      res.end(data);
    });
  } else if (isPedscommonsUrl&&(optionsPedscommons.host !== undefinedHost)) {
    console.log("Pedscommons request: ", urlPath);
    getresultHttp(optionsPedscommons, urlPath, https).then(data => {
      res.writeHead(200, { "Content-Type": contentTypeJson, "Content-Length":responseLength(data)});
      res.end(data);
    });
  } else if (isStjudeUrl&&(optionsStjude.host !== undefinedHost)) {
    console.log("Stjude request: ", urlPath);
    getresultHttp(optionsPedscommons, urlPath, https).then(data => {
      res.writeHead(200, { "Content-Type": contentTypeJson, "Content-Length":responseLength(data)});
      res.end(data);
    });
  } else if (isKidsFirstUrl &&(optionsChop.host !== undefinedHost)) {
    console.log("KidsFirst request: ", urlPath);
    getresultHttp(optionsChop, urlPath, http).then(data => {
      res.writeHead(200, { "Content-Type": contentTypeJson, "Content-Length":responseLength(data)});
      res.end(data);
    });
  }else {//try to aggregate
    console.log("aggregate results request: ", urlPath);
    aggregateResults(urlPath).then(data => {
      let strRes = urlUtils.concatArray(data);
      res.writeHead(200, { "Content-Type": contentTypeJson, "Content-Length":responseLength(strRes)});
      res.end(strRes);
    });
  }
});

function getresultHttp(options, urlPath, proto) {
  let errJson = urlUtils.getDomain(options.host);
  let errorJson = new Object();
  errorJson.errorOrigin = errJson;
  errorJson.message = '';

  return new Promise ((resolve, reject) => {   
    let chunks = '';
    options.path = urlPath;
    const req = proto.request(options, (res) => {
      res.on('data', chunk => {
        chunks+= chunk;
      });
      res.on('end', () => {
        try {
          resolve(chunks);
        } catch (err) {
          console.error('error res.on: ', options.host, err.message);
          errorJson.message = err.message;
          resolve(JSON.stringify(errorJson));
        };
      });

    });
    req.on('timeout', () => {
        console.error('timeout: ', options.host);
        errorJson.message = errorJson.message + ' timeout';
        resolve(JSON.stringify(errorJson));
        req.destroy();
    });
    req.on('error', err => {
      console.error('error req: ', options.host, err.message);
      errorJson.message += err.message;
      resolve(JSON.stringify(errorJson));
    });
    req.end();
  });
}

function aggregateRequests(urlPath) {
  let toAggregate = [];
  //collect Promises from getresultHttp
  if (optionsChop.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsChop, urlPath, http));
  if (optionsPedscommons.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsPedscommons, urlPath, https));
  if (optionsTreehouse.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsTreehouse, urlPath, https));
  if (optionsStjude.host !== undefinedHost)
    toAggregate.push(getresultHttp(optionsStjude, urlPath, https));
  
  return Promise.all(toAggregate);
  //This was a test for one space
  //let requestChop = getresultHttp(optionsChop, urlPath, http);//Promise
  //return Promise.all([requestChop]);
  return Promise.all([requestChop, requestPedscommons, requestTreehouse, requestStjude]);
}
async function aggregateResults(urlPath){
  //console.log('aggregateResults started:', urlPath);
  //this is a direct test
  //return res = await getresultHttp(optionsChop, urlPath);//this works
  return res = await aggregateRequests(urlPath);
}

server.listen(3000, "localhost", () => {
  console.log("Listening for request");
});
