const {
    app,
    BrowserWindow,
    Menu,
    ipcMain,
    dialog
} = require("electron");
const {
    download
} = require("electron-dl");

// Keep a global reference of the window object, if you don"t, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 600,
        height: 500,
        resizable: false
    })

    // and load the index.html of the app.
    win.loadFile("index.html")

    // Build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    // Insert menu
    Menu.setApplicationMenu(mainMenu);

    // Emitted when the window is closed.
    win.on("closed", () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit()
    }
});

app.on("activate", () => {
    // On macOS it"s common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
});

// Catch URL to download
ipcMain.on("OCR:URLReady", function(e, remix, url, downloadFolder) {
    download(BrowserWindow.getFocusedWindow(), url, {
        directory: downloadFolder,
        onProgress: function(e) {
            win.webContents.send("OCR:DownloadProgress", e, remix);
        }
    }).then(dl => console.log(
        dl.getSavePath())).catch(console.error);
});

ipcMain.on("resize", function(e, x, y) {
    win.setSize(x, y);
});

ipcMain.on("OCR:SelectDirectory", function() {
    win.webContents.send("OCR:DirectorySelected", dialog.showOpenDialog(
        win, {
            title: "Select a folder",
            properties: ["openDirectory"]
        }));
});

// Creating menu template
const mainMenuTemplate = [{
    label: "File",
    submenu: [{
        label: "Sync",
        accelerator: "CommandOrControl+Y",
        click() {
            win.webContents.send("OCR:InitSync");
        }
    }, {
        label: "Settings",
        accelerator: "CommandOrControl+S",
        click() {
            win.webContents.send("OCR:ShowConfig");
        }
    }, {
        label: "Quit",
        accelerator: "CommandOrControl+Q",
        click() {
            app.quit();
        }
    }]
}, {
    label: "Help",
    submenu: [{
        label: "About...",
        click() {
            win.webContents.send("OCR:ShowAbout");
        }
    }]
}];

if (process.platform === "darwin") {
    mainMenuTemplate.unshift({});
}

if (process.env.NODE_ENV !== "production") {
    mainMenuTemplate.push({
        label: "DevTools",
        submenu: [{
            label: "Toggle",
            accelerator: "F12",
            click() {
                win.webContents.toggleDevTools();
            }
        }, {
            role: "reload"
        }]
    });
}