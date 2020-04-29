const axios = require('axios').default;
const fs = require('fs');
const mkdirp = require('mkdirp');

const GITHUB_BASE_URL = 'https://covid-19-testing.github.io';
const GOOGLE_BASE_URL = 'https://maps.googleapis.com';
const GOOGLE_API_KEY = 'AIzaSyBLkzKH5T4OMFauzbMR6SHhJoRrpu8LJAQ';

// Load local Json Data (list)
const list = require('./list.json');

let createFlag = true;

/**
 * Load Cmd Argvs
 * This program expect the folder name as first argument.
 * eg: npm start MyFolderName || npm start "My Folder Name"
 * || npm start /folder1/folder2/folder3
 */
const DEST_FOLDER = process.argv[2] ? process.argv[2] : `${__dirname}/output`;
console.log('DEST_FOLDER: ', DEST_FOLDER);

// Traverse local Json Data
let traverseJsonList = async (list) => {
  for(let i=0; i<list.length; i++) {
    let provinceState = await list[i].Province_State.toLowerCase().replace(/ /g, '-');
    console.log(`Processing data for ${provinceState}`);
    try{
      let dataFromGithub = await getDataFromGithub(GITHUB_BASE_URL,provinceState);
      let provinceDetails = await addLocationData(dataFromGithub);
      writeToFile(provinceDetails,provinceState);
    }catch(err){
      console.log(`Can't get data for ${provinceState}. ${err.message}`);
    }
  };
};

// Fetch data from github based on the country name
let getDataFromGithub = (baseUrl, param) => {
  let route = `/locations/${param}/complete.json`;
  let url = `${baseUrl}${route}`;
  console.log(`Getting data from.. ${url}`);
  return new Promise((resolve, reject) => {
  axios.get(url)
  .then((responce) => {
    let organizationArray = [];
    let data = responce.data;
    data.forEach(element => {
      let organisation = {
        id : element.id,
        organization_id: element.organization_id,
        name: element.name,
        alternate_name: element.alternate_name,
        physical_address: element.physical_address
      }
      organizationArray.push(organisation);
    });
    return resolve(organizationArray);
    
  })
  .catch(err => {
    return reject(err);
  })
});
};

// Fetch data via google API to get location details
let getLocationInfo = (baseUrl, param) => {
  let route = `/maps/api/geocode/json`;
  let url = `${baseUrl}${route}?address=${param.address}&key=${param.key}`;

  console.log(`Getting data from.. ${url}`);
  return new Promise((resolve, reject) => {
  axios.get(url)
  .then((responce) => {
    try{
      let data = responce.data;
      let location = data.results[0].geometry.location;
      return resolve(location);
    } catch(err){
      return reject(err);
    }
  })
  .catch(err => {
    return reject(err);
  })
});
};

// Add Location data to github data
let addLocationData = (dataFromGithub) => {
  let newProvinceList = [];
  let getAllLocations = async () => {
    for(let i=0; i<dataFromGithub.length; i++){
      try{
        if(dataFromGithub[i].physical_address[0] && dataFromGithub[i].physical_address[0].postal_code){
          let param = {
            key: GOOGLE_API_KEY,
            address: dataFromGithub[i].physical_address[0].postal_code
          }
          let dataFromGoogle = await getLocationInfo(GOOGLE_BASE_URL, param);
          dataFromGithub[i]["location"] = dataFromGoogle;
          newProvinceList.push(dataFromGithub[i]);
        } else{
          // TODO: Log error to file
          console.error('Physical address not found.');
        }
      }catch(err){
        console.log(`Error in getting location details: ${err}`)
        return null;
      }
    };
    return newProvinceList;
  }
  return new Promise((resolve, reject) => {
    try{
      let proviceList = getAllLocations();
      return resolve (proviceList);
    } catch(err){
      return reject(err);
    }
})
}

// Write To File
let writeToFile = (jsonData, fileName) => {
  let folderPath = DEST_FOLDER;
  let filePath = `${folderPath}/${fileName}.JSON`;
    if(jsonData===null){
      console.log(`No Data found for ${fileName}.`)
      return;
    }
    try {
      console.log(`Writting data to file...`);
      mkdirp(folderPath).then(made => {
        if(made) console.log(`made directories, starting with ${made}`);
        let strigData = JSON.stringify(jsonData);
        fs.writeFileSync(filePath, JSON.stringify(jsonData));
        
        let allData;
        if(!createFlag){
          allData = fs.readFileSync(`${folderPath}/all.JSON`); 
          allData = JSON.parse(allData).concat(jsonData);
        } else{
          allData = jsonData;
          createFlag = false;
        }
        // fs.appendFileSync(`${folderPath}/all.JSON`, strigData.substring(1, strigData.length-1));
        fs.writeFileSync(`${folderPath}/all.JSON`, JSON.stringify(allData));
      });
      console.log(`Data for ${fileName} saved to file.`);
    } catch (err) {
      console.error(err)
    }
}

// Start Method to process all the data one by one
traverseJsonList(list);