import express from 'express';
import axios from 'axios';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3000;

// Agent để bỏ qua lỗi SSL self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

app.use(express.json());

// Middleware để lọc headers không cần thiết
function cleanHeaders(headers) {
  const { host, connection, 'content-length': contentLength, ...rest } = headers;
  return rest;
}

// Hàm dùng để forward request
async function forwardRequest(req, res, type) {
  const { id } = req.params;
  const url = `https://plugins-api.jarvis.cx/api/v1/zendesk/${type}-webhook/${id}`;

  try {
    const response = await axios({
      method: req.method,
      url,
      headers: {
        ...cleanHeaders(req.headers),
        'User-Agent': 'MyNodeForwarder/1.0',
        'Content-Type': 'application/json'
      },
      data: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : req.body,
      httpsAgent
    });

    res.status(response.status).send(response.data);
  } catch (err) {
    console.error(`❌ Error forwarding ${type} webhook:`, err.message);
    res
      .status(err.response?.status || 500)
      .send(err.response?.data || { error: 'Internal error' });
  }
}
app.get("/health", (req, res) => {
  res.send({ status: "OK" });
});

// Route: /comment-webhook/:id
app.all('/api/v1/zendesk/comment-webhook/:id', async (req, res) => {
  await forwardRequest(req, res, 'comment');
});

// Route: /ticket-webhook/:id
app.all('/api/v1/zendesk/ticket-webhook/:id', async (req, res) => {
  await forwardRequest(req, res, 'ticket');
});

// Route: /conversation-webhook/:id
app.all('/api/v1/zendesk/conversation-webhook/:id', async (req, res) => {
  await forwardRequest(req, res, 'conversation');
});

// Route: /api/v1/zoho-desk/webhook/callback?tenantId={id}
app.all('/api/v1/zoho-desk/webhook/callback', async (req, res) => {
  const { tenantId } = req.query;
  
  if (!tenantId) {
    return res.status(400).send({ error: 'tenantId query parameter is required' });
  }

  const url = `https://plugins-api.jarvis.cx/api/v1/zoho-desk/webhook/callback?tenantId=${tenantId}`;

  try {
    const response = await axios({
      method: req.method,
      url,
      headers: {
        ...cleanHeaders(req.headers),
        'User-Agent': 'MyNodeForwarder/1.0',
        'Content-Type': 'application/json'
      },
      data: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : req.body,
      httpsAgent
    });

    res.status(response.status).send(response.data);
  } catch (err) {
    console.error(`❌ Error forwarding Zoho Desk webhook:`, err.message);
    res
      .status(err.response?.status || 500)
      .send(err.response?.data || { error: 'Internal error' });
  }
});

// Health check route
app.all('/', (req, res) => {
  res.send({ status: 'OK', message: 'Webhook forwarder is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
