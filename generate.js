const fs = require('fs');
const readline = require('readline');
const https = require('https');
const ipRegex =/^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;

const getARecord=(host)=>{
	return new Promise((resolve,reject)=>{
		https.get("https://dns.google/resolve?type=A&name="+host,(response)=>{
			var body="";
			response.on('data',(chunk)=>{
				body+=chunk;
			});
			response.on('end',()=>{
				try {
					let json=JSON.parse(body);
					if(!json.Answer){
						reject('Host not available');
						return;
					}
					var ip=[];
					json.Answer.forEach((item)=>{
						if(ipRegex.test(item.data)){
							ip.push(item.data);
						}
					});
					resolve(ip);
				}catch(e){
					reject(e);
				}
			});
		}).on('error',(e)=>{
			reject(e);
		})
	});
}

const lineByLine=async(file,output,{multiIp})=>{
	var newHost={};
	var unResolved=[];
	const fileStream = fs.createReadStream(file);

	const read = readline.createInterface({
		input:fileStream,
		crlfDelay:Infinity
	});

	var promises = [];
	for await (const line of read){
		let value = line.trim();
		if(value.length===0||value.substring(0,1)==="#"){
			continue;
		}
		let getRecord=getARecord(value)
		.then((ips)=>{
			if(multiIp){
				ips.forEach((ip)=>{
					if(!newHost[ip]){
						newHost[ip]=[];
					}
					newHost[ip].push(value);
				});
			}else{
				let ip=ips[0];
				if(!newHost[ip]){
					newHost[ip]=[];
				}
				newHost[ip].push(value);
			}
		})
		.catch((e)=>{
			unResolved.push(value);
		});
		promises.push(getRecord);
	}
	Promise.all(promises).then(()=>{
		if(fs.existsSync(output)){
			fs.unlinkSync(output);
		}
		Object.keys(newHost).forEach((ip)=>{
			fs.appendFileSync(output,ip+" "+newHost[ip].join(' ')+"\n");
		});
		console.error("UNRESOLVED: "+unResolved);
	})
}
lineByLine('input.txt','output.txt',{
	multiIp:false
});