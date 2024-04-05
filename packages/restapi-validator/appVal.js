const express = require('express');
const path = require('path');
const http = require('http');
const cookieParser = require('cookie-parser'); // Add if using cookie auth
//const { Info } = require('./services'); //this is a directory if required
const OpenApiValidator = require('express-openapi-validator');
const mapHosts = new Map([["pcdc", "ccdifederation.pedscommons.org"], ["stjude", "ccdi.stjude.cloud"], ["ucsc", "ccdi.treehouse.gi.ucsc.edu"]]);

const port = 3112;
const app = express();
const apiSpec = path.join(__dirname, 'api.yaml');

const https = require('https');
var optionsStJude = {
  host: "ccdi.stjude.cloud",
  //host: "ccdi.treehouse.gi.ucsc.edu",
  //host: "ccdifederation.pedscommons.org",
  //path: urlPath,
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
  timeout: 4000,
  rejectUnauthorized: false
};

const args = process.argv;
console.log("args", args);
let hostInfo = args[2];//expect 

// 1. Install bodyParsers for the request types your API will support
app.use(express.urlencoded({ extended: false }));
app.use(express.text());
app.use(express.json());
app.use(cookieParser()); // Add if using cookie auth enables req.cookies
//const fs = require('fs');//This is for tests
//var testdata = JSON.parse(fs.readFileSync('./testSummary.json', 'utf8'));


// Optionally serve the API spec
app.use('/spec', express.static(apiSpec));

//  2. Install the OpenApiValidator on express app
app.use(
  OpenApiValidator.middleware({
    apiSpec,
    validateResponses: true, // default false
  }),
);

// 3. Add routes
app.get('/ping', function (req, res, next) {
  res.send('pong');
});
app.get('/api/v0/*', function (req, res, next) {
  var options = structuredClone(optionsStJude);
  options.path = req.originalUrl;
  console.log("info",req.originalUrl);
  //These are validatio tests instead of requesting from API endpoint
  //let testdata = require('./testSummary.json');
  //let testdata = require('./testStJudeId.json');
  // subject/stjude/SJ000003
  //let testdata = require('./testSubjectNoMetadata.json');
  //let testdata = require('./testByCountWithMissing.json');
  //let testdata = require('./testStJudeIdWrongPVs.json');
  //res.json(testdata);
  aggregateResults(req.originalUrl).then(data => {
    console.log('data', data);
    res.json(JSON.parse(data));
  });
});
// 4. Create a custom error handler 
app.use((err, req, res, next) => {
  // format errors
  //remove error related to comments and unharmonized
  err.errors = err.errors.filter(item => (
    ! ((item.path.endsWith(".comment")) || (item.path.includes(".unharmonized")))
  ));
  if (err.errors.length == 0) err.message = "";

  res.status(err.status || 500).json({
    errors: err.errors,
  });
});
//send the request to API endpoint
function getresultHttp(optionsNode, urlPath, proto) {
  return new Promise ((resolve, reject) => {
    let chunks = '';
    var options = structuredClone(optionsNode);
    options.path = urlPath;
    if ((hostInfo) && mapHosts.get(hostInfo)) {
        options.host = mapHosts.get(hostInfo);
    }
    console.log("info", options);
    const req = proto.request(options, (res) => {
      //console.log("statusCode: ", res.statusCode); // <======= Here's the status code
      //console.log("headers: ", res.headers);
      res.on('data', chunk => {
        chunks+= chunk;
      });
      res.on('end', () => {
        try {
          resolve(chunks);
        } catch (err) {
          console.error('error res.on getresultHttp: ', options.host, err.message);
          console.error(err);
          //errorJson.message = err.message;       
          resolve(urlUtils.addSourceAttr(err.message,options,urlPath));
        };
      });
    });
    req.on('timeout', () => {
        console.error('timeout: ', options.host);
        let dataTimeout = urlUtils.getErrorStrTimeout(urlPath, urlUtils.findRequestSource(options.host));
        dataTimeout = urlUtils.addSourceAttr(dataTimeout,options,urlPath);
        resolve(dataTimeout);
        req.destroy();
    });
    req.on('error', err => {
      console.error('error req: ', options.host, err.message);
      console.error(err);
      resolve(urlUtils.addSourceAttr(err.message,options,urlPath));
    });
    req.end();
  });
}
//This is to wait for API endpoint response
async function aggregateResults(urlPath){
  return res = await getresultHttp(optionsStJude, urlPath, https);//this works
}

http.createServer(app).listen(port);
console.log(`Listening on port ${port}`);


