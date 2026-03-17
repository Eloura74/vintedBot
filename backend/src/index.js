const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { sequelize, Task } = require('./models');

const app = express();
const port = process.env.PORT || 3001;

// WebSocket Server for Worker communication
const wss = new WebSocket.Server({ noServer: true });
const workers = new Set();

wss.on('connection', (ws) => {
  console.log('👷 Worker connected via WebSocket');
  workers.add(ws);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'log') {
        // Broadcast worker logs to SSE clients
        app.emit('worker_log', message.payload);
      }
    } catch (e) {
      console.error('WS Message Error:', e);
    }
  });

  ws.on('close', () => {
    console.log('👷 Worker disconnected');
    workers.delete(ws);
  });
});

const broadcastToWorkers = (data) => {
  const msg = JSON.stringify(data);
  workers.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
};

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.findAll();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = await Task.create(req.body);
    broadcastToWorkers({ type: 'task_created', task });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await task.update(req.body);
    broadcastToWorkers({ type: 'task_updated', task });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.destroy({ where: { id: req.params.id } });
    broadcastToWorkers({ type: 'task_deleted', taskId: req.params.id });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real-time Logs Stream (SSE)
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const logHandler = (log) => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  };

  app.on('worker_log', logHandler);

  req.on('close', () => {
    app.off('worker_log', logHandler);
    res.end();
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'vinted-api' });
});

// Function to sync DB with retries
const syncDB = async (retries = 10) => {
  while (retries) {
    try {
      await sequelize.authenticate();
      await sequelize.sync({ alter: true });
      console.log('✅ Database connected and synced successfully (Status field added)');
      return;
    } catch (err) {
      console.log(`⏳ Database not ready, retrying in 5s... (${retries} retries left)`);
      console.log(`Error: ${err.message}`);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  console.error('❌ Could not connect to database after several retries. Exiting.');
  process.exit(1);
};

// Sync database and start
syncDB().then(() => {
  const server = app.listen(port, () => {
    console.log(`🚀 API listening at http://localhost:${port}`);
  });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});
