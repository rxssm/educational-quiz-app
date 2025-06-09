export default async function handler(req, res) {
    try {
        // Basic test
        console.log('Test function called');
        
        // Check environment
        const hasApiKey = !!process.env.DEEPSEEK_API_KEY;
        
        // Return test data
        res.status(200).json({
            status: 'success',
            message: 'Test function working',
            timestamp: new Date().toISOString(),
            hasApiKey: hasApiKey,
            nodeVersion: process.version,
            method: req.method,
            headers: Object.keys(req.headers)
        });
    } catch (error) {
        console.error('Test function error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
}