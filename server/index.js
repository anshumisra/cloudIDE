const http=require('http');
const express=require('express');
const {Server:SocketServer}=require('socket.io')
const fs=require('fs/promises')
const path=require('path')
const pty=require('@lydell/node-pty');
const app=express();
const server=http.createServer(app);
const cors=require('cors');
const chokidar = require('chokidar');


const io=new SocketServer({
    cors:'*'
})
app.use(cors());
//var shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
const ptyProcess = pty.spawn('powershell.exe', [], {
    name: 'xterm-color',
    cols: 180,
    rows: 30,
    cwd: path.join(process.env.INIT_CWD, "user"),
    env: process.env
  });
  

io.attach(server);

chokidar.watch(path.join(process.env.INIT_CWD,'user')).on('all',(event,path)=>{
    io.emit('file:refresh',{event,path});
})

ptyProcess.onData(data=>{
    io.emit('terminal:data',data);
})

io.on('connection',(socket)=>{
    console.log(`socket connected`,socket.id); 

    socket.emit('file:refresh');

    socket.on('terminal:write',(data)=>{
        ptyProcess.write(data);
    })
})

app.get('/files',async(req,res)=>{
    const fileTree=await generateFileTree(path.join(process.env.INIT_CWD,'user'));
    return res.json({tree:fileTree});
})

async function generateFileTree(directory){
const tree={}
async function buildTree(currentDir,currentTree){
    const files=await fs.readdir(currentDir);
    for(const file of files){
        const filePath=path.join(currentDir,file);
        const stat=await fs.stat(filePath)

        if(stat.isDirectory()){
            currentTree[file]={}
            await buildTree(filePath,currentTree[file]);
        }else{
            currentTree[file]=null;
        }
    } 
}
await buildTree(directory,tree);
return tree;
}

server.listen(9000,()=>console.log(`Docker server running`));