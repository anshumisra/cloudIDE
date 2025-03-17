const http = require('http')
const express = require('express')
const fs = require('fs/promises')
const { Server: SocketServer } = require('socket.io')
const path = require('path')
const cors = require('cors')
const chokidar = require('chokidar');

const pty = require('@lydell/node-pty');

const app = express()
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const ptyProcess = pty.spawn('powershell.exe', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.INIT_CWD + '/user',
    env: process.env
});

app.use(cors())


chokidar.watch(path.join(process.env.INIT_CWD,'user')).on('all', (event, path) => {
    io.emit('file:refresh', path)
});

ptyProcess.onData(data => {
    io.emit('terminal:data', data)
})

io.on('connection', (socket) => {
    console.log(`Socket connected`, socket.id)

    socket.emit('file:refresh')

    socket.on('file:change', async ({ path1, content }) => {
        const filePath=path.join(process.env.INIT_CWD,'user',path1)
        console.log('File change', filePath)
        await fs.writeFile(filePath, content)
    })

    socket.on('terminal:write', (data) => {
        console.log('Term', data)
        ptyProcess.write(data);
    })
})

app.get('/files', async (req, res) => {
    const fileTree = await generateFileTree(path.join(process.env.INIT_CWD,'user'));
    return res.json({ tree: fileTree })
})

app.get('/files/content', async (req, res) => {
    const content = await fs.readFile(path.join(process.env.INIT_CWD,'user',req.query.path), 'utf-8')
    return res.json({ content })
})

server.listen(9000, () => console.log(`🐳 Docker server running on port 9000`))


async function generateFileTree(directory) {
    const tree = {}

    async function buildTree(currentDir, currentTree) {
        const files = await fs.readdir(currentDir)

        for (const file of files) {
            const filePath = path.join(currentDir, file)
            const stat = await fs.stat(filePath)

            if (stat.isDirectory()) {
                currentTree[file] = {}
                await buildTree(filePath, currentTree[file])
            } else {
                currentTree[file] = null
            }
        }
    }

    await buildTree(directory, tree);
    return tree
}