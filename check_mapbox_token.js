import https from 'https';
import fs from 'fs';
import path from 'path';

// Read .env.local file
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local file not found!');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/VITE_MAPBOX_API_KEY=["']?(pk\.[a-zA-Z0-9.-]+)["']?/);

if (!match) {
    console.error('Error: VITE_MAPBOX_API_KEY not found in .env.local');
    process.exit(1);
}

const token = match[1];
console.log(`Checking Mapbox Token: ${token.substring(0, 10)}...`);

const options = {
    hostname: 'api.mapbox.com',
    path: `/styles/v1/mapbox/streets-v11?access_token=${token}`,
    method: 'GET'
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 401) {
            console.error('\n❌ Invalid Token! Mapbox returned 401 Unauthorized.');
            try {
                const parsed = JSON.parse(data);
                console.error(`Message: ${parsed.message}`);
            } catch (e) {
                console.error(data);
            }
            console.log('\nPlease go to https://account.mapbox.com/ and create a new public token.');
        } else if (res.statusCode === 200) {
            console.log('\n✅ Success! Your Mapbox token is valid.');
        } else {
            console.log(`\n⚠️ Unexpected status code: ${res.statusCode}`);
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
