const {app, BrowserWindow, ipcMain, Menu, globalShortcut, dialog, Tray} = require('electron');

const ps = require('ps-node');
const exec = require('child_process').exec

var rec_tool_url = 'update.zgyjyx.com/tools/scree-rec'


let mainWindow;

app.on('window-all-closed', function() {
  app.quit();
});

//
var trayBlinkTimer = null;
var trayBlinkImages = ['rec1.png', 'rec2.png'];
var trayBlinkState = 0;
var isRecording = false;

app.on('ready', function() {
  appIcon = new Tray(__dirname+'/images/yj.ico');
  const contextMenu = Menu.buildFromTemplate([
    {label: '开始|停止', accelerator:'F10',
      click(item, focusedWindow) {
        mainWindow.send('hotkey', {data:'F10'});
      }
    },
    {label: '暂停|继续', accelerator:'F11',
      click(item, focusedWindow) {
        mainWindow.send('hotkey', {data:'F11'});
      }
    },
    {
      label: '退出',
      click() {
        ps.kill('ffmpeg.exe', function(err){
          app.quit();
        });
      }
    }
  ]);
  appIcon.setToolTip('亿教亿学');
  appIcon.setContextMenu(contextMenu);

  //
  function blinkTray(){
    if(trayBlinkTimer) clearInterval(trayBlinkTimer);
    trayBlinkTimer = setInterval(function(){
      appIcon.setImage(__dirname + '\\images\\' + trayBlinkImages[trayBlinkState]);
      trayBlinkState = 1 - trayBlinkState;
    }, 0.5* 1000);
  }

  function stillTray(){
    if(trayBlinkTimer) clearInterval(trayBlinkTimer);
    appIcon.setImage(__dirname + '\\images\\yj.ico');
  }

  function setPenColor(r,g,b) {
    var cmd = `cmd /c wscript resources\\app\\bin\\pen.vbs ${r} ${g} ${b}`;
    exec(cmd);
  }
  mainWindow = new BrowserWindow({minWidth: 800, minHeight: 500, width: 800, height: 500, icon:__dirname+'/images/yj.ico' });
  mainWindow.setMenu(null);
  mainWindow.loadURL('file://' + __dirname + '/browser.html');
  // check for update

  //mainWindow.openDevTools();
  var lastF10 = 0;
  const PREVENT_INTERVAL = 2; // 2 seconds
  var ret = globalShortcut.register('F10', () => {
    var now = new Date().getTime()/1000;
    var delta = now - lastF10;
    if(delta < PREVENT_INTERVAL) {
      return;
    }
    lastF10 = new Date().getTime()/1000;

    isRecording = !isRecording;
    if(isRecording) {
      var win = new BrowserWindow({width: 200, height: 60, frame: false, parent:mainWindow, backgroundColor:'#F0FF33'});
      win.loadURL('file://' + __dirname + '/start.html');
      // close the message window after 2s
      setTimeout(function(){
        win.close();
        // delay 0.5s for the message window to close
        setTimeout(function(){
          mainWindow.send('hotkey', {data:'F10'});
          blinkTray();
        },0.5 * 1000);
      }, 2 * 1000);
    }else{
      stillTray();
      mainWindow.send('hotkey', {data:'F10'});
      // show the message 1s later
      setTimeout(function(){
        var win = new BrowserWindow({width: 200, height: 60, frame: false, parent:mainWindow, backgroundColor:'#F0FF33'});
        win.loadURL('file://' + __dirname + '/stop.html');
        // 1s later we close the messagebox
        setTimeout(function(){
          win.close();
          mainWindow.focus();
        }, 1 * 1000);
      }, 1 * 1000);
    }
  });

  var isPaused = false;
  var lastF11 = 0;
  ret = ret && globalShortcut.register('F11', () => {
    var now = new Date().getTime()/1000;
    var delta = now - lastF11;
    if(delta < PREVENT_INTERVAL) {
      return;
    }
    lastF11 = new Date().getTime()/1000;
    // console.log('F11 is pressed');
    if(isRecording && !isPaused) {
      isPaused = true;
      // pause before show message
      mainWindow.send('hotkey', {data:'F11'});
      // 2s later we show the pause message
      setTimeout(function(){
        var pauseWin = new BrowserWindow({width: 200, height: 60, frame: false, parent:mainWindow, backgroundColor:'#F0FF33'});
        pauseWin.loadURL('file://' + __dirname + '/pause.html');
        // 1.5s later to close the message window
        setTimeout(function(){
          pauseWin.close();
        }, 3 * 1000);
      }, 1 * 1000);
      stillTray();
    }else if(isRecording && isPaused){
      isPaused = false;
      var resumeWin = new BrowserWindow({width: 200, height: 60, frame: false, parent:mainWindow, backgroundColor:'#F0FF33'});
      resumeWin.loadURL('file://' + __dirname + '/resume.html');
      setTimeout(function(){
        resumeWin.close();
        // start recording after the message window closed
        setTimeout(function(){
          mainWindow.send('hotkey', {data:'F11'});
        }, 1 * 1000);
      }, 1.5 * 1000);
      blinkTray();
    }
  });

  ret = ret && globalShortcut.register('ctrl+shift+i', () => {
    mainWindow.openDevTools();
  });

  // white pen
  ret = ret && globalShortcut.register('shift+alt+1', () => {
    setPenColor(255,255,255);
  })
  // black pen
  ret = ret && globalShortcut.register('shift+alt+2', () => {
    setPenColor(0,0,0);
  })
  // yellow pen
  ret = ret && globalShortcut.register('shift+alt+3', () => {
    setPenColor(255,255,0);
  })
  // blue pen
  ret = ret && globalShortcut.register('shift+alt+4', () => {
    setPenColor(0,0,255);
  })
  // red pen
  ret = ret && globalShortcut.register('shift+alt+5', () => {
    setPenColor(255,0,0);
  })

  if (!ret) {
    dialog.showErrorBox('','注册热键失败， 请检查F10,F11是否被其他程序绑定后再启动');
  }


  //
  var quit = false;
  mainWindow.on('close', function(event){
    appIcon.destroy();
    if(!quit) {
      event.preventDefault();
      quit = true;
    }

    mainWindow.hide();
    mainWindow.send('hotkey', {data:'exit'});
    setTimeout(function(){
      ps.kill('ffmpeg.exe', function(err){
          app.quit();
      });
    }, 5 * 1000);
  });
});

app.on('close', (event) => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

//
ipcMain.on('asynchronous-message', (event, arg) => {
  console.log(arg);  // prints "ping"
  // event.sender.send('asynchronous-reply', 'pong');
  if(arg) {
    var msg = null;
    try{
      msg = JSON.parse(arg);
    }catch (e) {
      // console.log(e);
      return;
    }

    switch(msg.event) {
      // case 'button':
      //   switch(msg.data){
      //     case 'playvideo':
      //     dialog.showOpenDialog();
      //   }
      //   break;
      case 'state':
        switch(msg.data) {
          case 'recording':
            //trayBlinkTimer = setInterval();
            break;
          case 'stopped':
            break;
           default:
            console.log('unknown state:', msg);
        }
        break;
      default:
        console.log('unknown msg:', msg);
    }
  }
});

ipcMain.on('synchronous-message', (event, arg) => {
  console.log(arg);  // prints "ping"
  event.returnValue = 'pong';
});
