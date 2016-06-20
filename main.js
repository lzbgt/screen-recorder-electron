const {app, BrowserWindow, ipcMain, globalShortcut} = require('electron');

let mainWindow;

app.on('window-all-closed', function() {
  app.quit();
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 1024, height: 500 });
  mainWindow.setMenu(null);
  mainWindow.loadURL('file://' + __dirname + '/browser.html');
  //mainWindow.openDevTools();
  var ret = globalShortcut.register('F10', () => {
    console.log('F10 is pressed');
    mainWindow.send('hotkey', {data:'F10'});
  });

  ret = ret && globalShortcut.register('F11', () => {
    console.log('F10 is pressed');
    mainWindow.send('hotkey', {data:'F11'});
  });

  ret = ret && globalShortcut.register('ctrl+shift+i', () => {
    mainWindow.openDevTools();
  });

  if (!ret) {
    console.log('registration failed');
  }

});

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

ipcMain.on('asynchronous-message', (event, arg) => {
  console.log(arg);  // prints "ping"
  event.sender.send('asynchronous-reply', 'pong');
});

ipcMain.on('synchronous-message', (event, arg) => {
  console.log(arg);  // prints "ping"
  event.returnValue = 'pong';
});
