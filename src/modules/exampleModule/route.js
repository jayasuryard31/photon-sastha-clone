const express = require('express');
const { createExampleService } = require('./service');

const router = express.Router();

// Initialize service once; handlers await the promise before use
const servicePromise = createExampleService();

router.get('/test', async (_req, res) => {
	try {
		const service = await servicePromise;
		const data = await service.getData();
		res.status(200).json(data);
	} catch (err) {
		console.error('[exampleModule] get route failed', err);
		res.status(500).json({ error: 'internal_error' });
	}
});

module.exports = router;