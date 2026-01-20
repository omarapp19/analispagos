
const testApi = async () => {
    try {
        console.log('Testing API Health...');
        const health = await fetch('http://localhost:3001/api/health');
        if (health.ok) {
            console.log('Health check passed:', await health.json());
        } else {
            console.error('Health check failed:', health.status);
            process.exit(1);
        }

        console.log('Testing Settings API (Database connection)...');
        const settings = await fetch('http://localhost:3001/api/settings');
        if (settings.ok) {
            console.log('Settings fetched:', await settings.json());
            console.log('SUCCESS: API and Database are working!');
        } else {
            console.error('Settings fetch failed:', settings.status, await settings.text());
        }
    } catch (error) {
        console.error('API Test Failed:', error);
    }
};

testApi();
