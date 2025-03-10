const https = require('https'); //uncomment if using https
//const http = require('http'); //comment if using https
const fs = require('fs');

// The URL to fetch the JSON data namespaces
//const url = 'http://localhost:3000/api/v1/namespace';  // Replace with the actual AL URL
const url = 'https://federation-stage.ccdi.cancer.gov/api/v1/namespace'; // Replace with the actual AL URL
const outputFile = "namespaces-AL.csv";// output file name

// Endpoint "namespace" the headers that correspond to the data to extract
const headers = [
    'id.organization',
    'id.name',
    'metadata.study_name.value'
];

// JSON Path function to handle extracting values from hierarchical structures
// This approach should work for any nested JSON structure where to extract specific data based on known paths
function getValueByPath(obj, path) {
  const keys = path.split('.');
  let value = obj;

  for (let key of keys) {
    if (value === null || value === undefined) {
      return ''; // Return an empty string if value is null or undefined
    }
    
    // Handle array indexing (e.g., 'contacts[0].email')
    if (key.includes('[')) {
      const [arrayKey, index] = key.split('[');
      const idx = parseInt(index.split(']')[0]);
      value = value[arrayKey] ? value[arrayKey][idx] : undefined;
    } else {
      value = value[key];
    }

    // If value becomes null or undefined during traversal, return an empty string
    if (value === null || value === undefined) {
      return '';
    }
  }
  
  return value;
}

// Making an HTTP[S] GET request to fetch the array of arrays of objects namespace endpoint
https.get(url, (response) => {
  let data = '';

  // A chunk of data has been received.
  response.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received.
  response.on('end', () => {
    try {
      // Parse the JSON data (which is an array of arrays of objects)
      const jsonData = JSON.parse(data);

      // Flatten the array of arrays of objects into a single array
      const flattenedData = jsonData.flat();
      // Extract the relevant data based on the JSON paths
      const extractedData = flattenedData.map(item => {
        let row = {};
        headers.forEach(path => {
          row[path] = getValueByPath(item, path);  // Extract data using the path
        });
        return row;
      });

      // Convert the extracted data to CSV
      const csvData = jsonToCsv(extractedData);

      // Write CSV to a file
      fs.writeFileSync(outputFile, csvData);

      console.log("CSV file created successfully.", outputFile);
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }
  });

}).on('error', (err) => {
  console.error('Request failed', err);
});

// Function to convert JSON data to CSV
function jsonToCsv(data) {
  const headers = Object.keys(data[0]);
  const rows = data.map(item => 
    headers.map(header => {
      const value = item[header] === undefined ? '' : item[header]; // Replace undefined with empty string
      // values contain commas, adding quotes or use tab separted values
      return `"${value}"`;  // Return quoted value if using comma separated
    }).join(',')//.join('\t')
  );
  
  const csv = [headers.join(','), ...rows].join('\n');//.join('\t') if using tab separated
  return csv;
}
