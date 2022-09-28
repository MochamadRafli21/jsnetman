const express = require('express');
const network = require("node-network-manager");
const {spawnSync, exec} = require('child_process');
const wifi = require('node-wifi');
const bodyParser = require('body-parser');
const path = require( 'path' );
const fs = require("fs");
const jsonParser = bodyParser.json()


wifi.init({
    iface: null // network interface, choose a random wifi interface if set to null
  });


const app = express()


const execScan = (interface) => {
  return new Promise((resolve, reject) => {
    exec(`echo "calonsukses" | sudo -S timeout 5s airodump-ng -w scan/output ${interface} --output-format csv`,{ maxBuffer: 1024 * 10000000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn(`exec error: ${err}`);
      }

      resolve(stdout? stdout:stderr)
    });    
  })
}

const getListInterface = () => {
  let listIntervace = spawnSync('iw', ['dev'])
  listIntervace = listIntervace.stdout.toString().trim().split('\n')
  let interface =""
  for(let i = 0; i < listIntervace.length; i++){
    if(listIntervace[i].split(' ')[0].match("\tInterface")){
      interface = listIntervace[i].split(' ')[1]
      break
    }
  }

  return interface
}

const pcaptotext = (files) => {
  return new Promise((resolve, reject) => {
    exec(`echo calonsukses | sudo -S tcpdump -A -r ${files} > csv/output.txt`, (err, stdout, stderr) => {
    if (err) {
        console.warn(`exec error: ${err}`);
      }
      resolve(stdout? stdout:stderr)
    })
  })
}

const startInterFace = (interface) => {
  return new Promise((resolve, reject) => {
    exec(`echo calonsukses | sudo -S airmon-ng start ${interface}`, (err, stdout, stderr) => {
    if (err) {
        console.warn(`exec error: ${err}`);
      }
      resolve(stdout? stdout:stderr)
    })
  })
}

const tunnelMonitor = (name, channel, tragetBssid, interface) => {
  return new Promise((resolve, reject) => {
    exec(`echo "calonsukses" | sudo -S timeout 40s airodump-ng --bssid ${tragetBssid} --essid ${name} -c ${channel} -w scan/output ${interface}`, { maxBuffer: 1024 * 10000000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn(`exec error: ${err}`);
      }
      resolve(stdout? stdout.toString():stderr)
    })
  })
}

const decrypt = (name, bssid, password, file) => {
  return new Promise((resolve, reject) => {
    exec(`echo "calonsukses" | sudo -S airdecap-ng -b ${bssid} -e ${name} -p ${password} ${file}`, { maxBuffer: 1024 * 10000000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn(`exec error: ${err}`);
      }
      resolve(stdout? stdout:stderr)
      
    })
  })
}

// endpoint untuk redirect ke view list wifi
app.get('/', async(req, res) => {
  res.sendFile(path.join(__dirname+'/views/index.html'));
})

// endpoint untuk redirect ke view list traffic
app.get('/traffic', async(req, res) => {
  res.sendFile(path.join(__dirname+'/views/traffic.html'));
})

app.get('/networks',jsonParser, async(req,res) =>{
    const networks = await wifi.scan()
    res.json(networks)
});

app.get('/networks/monitor/on', jsonParser, async(req, res) => {
  // mencari nama wifi card
  const interface = getListInterface()
  exec(`rm scan/*`)

  // connect dengan service airmon-ng
  await startInterFace(interface)
  res.json(interface)
})

app.get('/networks/monitor/scan', jsonParser, async(req, res) => {
  const interface = getListInterface()
  await execScan(interface)
  res.json("success")
})

app.post('/networks/monitor/scan', jsonParser, async(req, res) => {
  const {ssid, channel, bssid, password} = req.body
  const interface = getListInterface()
  await tunnelMonitor(ssid, channel, bssid, interface)
  let ls = spawnSync("ls", ["scan"])
  let files = ls.stdout.toString().trim().split("\n")
  for(let i = 0 ; i < files.length; i++){
    if(files[i].includes(".cap")){
      files = files[i]
      break
    }
  }
  await decrypt(ssid, bssid, password, `scan/${files}`)
  ls = spawnSync("ls", ["scan"])
  files = ls.stdout.toString().trim().split("\n")
  for(let i = 0 ; i < files.length; i++){
    if(files[i].includes("dec.cap")){
      files = files[i]
      break
    }
  }
  await pcaptotext(`scan/${files}`);
  ls = spawnSync("ls", ["csv"])
  files = ls.stdout.toString().trim().split("\n")[0]
  const text = fs.readFileSync(path.join(__dirname+`/csv/${files}`)).toString()

  res.json(text)
})

app.get('/networks/monitor/result', jsonParser, (req, res) => {
  let ls = spawnSync("ls", ["scan"])
  let files = ls.stdout.toString().trim().split("\n")[0]
  while(ls.stdout.toString() === "" && fs.readFileSync(path.join(__dirname+`/scan/${files}`)).toString().match("/BSSID/g") !== null){
    ls = spawnSync("ls", ["scan"])
    files = ls.stdout.toString().trim().split("\n")[0]
  }
  output = ''
  csv = fs.readFileSync(path.join(__dirname+`/scan/${files}`)).toString()
  if(csv){
    output += csv.toString().trim()
  }
  // for(let i = files.length-1; i >= 0;i--){
  //   csv = fs.readFileSync(path.join(__dirname+`/scan/${files[i]}`)).toString()
  //   if(csv){
  //     output += csv.toString().trim()
  //   }
  // }
  res.json(output.split("\n"))
})

app.get('/networks/monitor/off', jsonParser, async(req, res) => {

  const interface = getListInterface()

  // menghentikan service airmon
  exec(`echo calonsukses |sudo airmon-ng stop ${interface}`)
  res.json(interface)

})

app.get('/networks/connect',jsonParser, async(req,res) => {
    let networks = []
    // TODO GET LOSS PACKAGE USING PING!!
    await network
    .getConnectionProfilesList(false)
    .then(async (data) => {
      const ethernet = data.find((item) => item.TYPE === "ethernet");
      const device = data.find((item) => item.TYPE === "wifi");
      await network
        .getDeviceInfoIPDetail(ethernet.DEVICE)
        .then((data) => networks.push(data))
        .catch((error) => console.log(error));
      await network
        .getDeviceInfoIPDetail(device.DEVICE)
        .then((data) => networks.push(data))
        .catch((error) => console.log(error));
    })
    if(networks.length >= 1){
      const nmap = spawnSync('nmap',[networks[0].gatewayV4])
      let dataNmap = nmap.stdout.toString().trim()
      networks[0].nmap = dataNmap.split('\n')
  
      const loss = spawnSync('ping',['-c5',networks[0].gatewayV4])
      let dataLoss = loss.stdout.toString().trim()
      dataLoss = dataLoss.split('\n')[8].split(',')[2]
      networks[0].loss = dataLoss
    }

    res.json(networks)

});

app.delete('/networks/connect',jsonParser,(req,res) => {
  const ssid = req.body.ssid
  if(!ssid){
    throw new Error('ssid is required')
  }
  const result = spawnSync('nmcli',["con", "down", "id", ssid])
  res.json(result)

})

app.post('/networks/connect',jsonParser, async(req,res) => {
    const ssid = req.body.ssid
    const password = req.body.password
    try{
      await wifi.connect({ ssid: ssid, password: password });
    }catch(e){
      console.log(e)
    }
    res.json({status:"success"})
      
});

const server = app.listen(3000)