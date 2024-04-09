const express = require('express');
const path = require('path');
const http = require('http');
const cookieParser = require('cookie-parser'); // Add if using cookie auth
//const { Info } = require('./services'); //this is a directory if required
const OpenApiValidator = require('express-openapi-validator');

const port = 3112;
const app = express();
const apiSpec = path.join(__dirname, 'api.yaml');

const https = require('https');
var optionsStJude = {
  host: "ccdi.stjude.cloud",
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

// 1. Install bodyParsers for the request types your API will support
app.use(express.urlencoded({ extended: false }));
app.use(express.text());
app.use(express.json());
app.use(cookieParser()); // Add if using cookie auth enables req.cookies

//const fs = require('fs');//This is for tests
//let testdata = JSON.parse(fs.readFileSync('./testSummary.json', 'utf8'));

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
  console.log("info",req.originalUrl, req.protocol, req.headers['x-federation-node']);
  //These are validatio tests instead of requesting from API endpoint
  //let testdata = require('./tests/testSummary.json');
  //let testdata = require('./tests/testByIdStJude.json');
  //let testdata = require('./tests/testByCount.json');
  //let testdata = require('./tests/testFileSearch.json');
  //let testdata = require('./tests/testByIdUcsc.json');
  //res.json(testdata);
  aggregateResults(req).then(data => {
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
function getresultHttp(optionsNode, urlPath, proto, hostInfo) {
  return new Promise ((resolve, reject) => {
    let chunks = '';
    let options = structuredClone(optionsNode);
    options.path = urlPath;
    if (hostInfo) {
        options.host = hostInfo;
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
async function aggregateResults(req){
  return res = await getresultHttp(optionsStJude, req.originalUrl, 
  https, req.headers['x-federation-node']);//x-federation-node header host expected
}

http.createServer(app).listen(port);
console.log(`Listening on port ${port}`);


