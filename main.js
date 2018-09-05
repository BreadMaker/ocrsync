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
const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto');

// Keep a global reference of the window object, if you don"t, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, active = Array();

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 600,
        height: 500,
        resizable: false,
        icon: path.join(__dirname, 'assets/icon.png')
    })

    // and load the index.html of the app.
    win.loadFile("index.html")

    // Build menu from template and insert menu
    Menu.setApplicationMenu(Menu.buildFromTemplate(mainMenuTemplate));

    win.on("close", (e) => {
        if (active.length > 0) {
            var choice = dialog.showMessageBox(null, {
                type: 'question',
                buttons: ['Yes', 'No'],
                title: 'Sync about to be interrupted',
                message: 'There\'s a sync in progress.\nAre you sure you want to exit?'
            })
            if (choice == 1) {
                e.preventDefault()
            }
        }
    })

    // Emitted when the window is closed.
    win.on("closed", () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })
}

function checkMD5(remix, filename, md5Sum, callback) {
    win.webContents.send("OCR:MD5Check", remix, "start");
    const hash = crypto.createHash('md5'),
        input = fs.createReadStream(filename)
    input.on('readable', () => {
        const data = input.read()
        if (data) hash.update(data)
        else {
            if (hash.digest('hex') === md5Sum) {
                win.webContents.send("OCR:MD5Check", remix, "correct")
                callback.correct()
            } else {
                win.webContents.send("OCR:MD5Check", remix, "mismatch")
                callback.mismatch()
            }
        }
    })
}

function downloadFile(remix, url, downloadFolder, md5Sum) {
    download(win, url, {
        directory: downloadFolder,
        onStarted: function(item) {
            active.push(remix)
            ipcMain.once("OCR:StopSync", function() {
                item.cancel()
                active = active.filter(number => number !==
                    remix)
            })
            item.once('done', (event, state) => {
                if (state === 'completed') {
                    checkMD5(remix, item.getSavePath(),
                        md5Sum, {
                            correct: function() {
                                active = active.filter(
                                    number =>
                                    number !==
                                    remix)
                                return
                            },
                            mismatch: function() {
                                // mismatched MD5 should also mean that the hash
                                // informed is wrong, for now it'll show a
                                // warning, but in the future it must offer
                                // options to the user
                                active = active.filter(
                                    number =>
                                    number !==
                                    remix)
                                return
                            }
                        })
                } else {
                    console.log(
                        `Download failed: ${state}`
                    )
                }
            })
        },
        onProgress: function(e) {
            win.webContents.send("OCR:DownloadProgress",
                e, remix);
        },
        onCancel: function() {
            // console.log("CANCELLED");
        }
    }).catch(console.error);
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
ipcMain.on("OCR:URLReady", function(e, remix, urlList, downloadFolder, md5Sum) {
    var url = urlList[Math.floor(Math.random() * urlList.length)],
        filename = path.format({
            dir: downloadFolder,
            base: decodeURI(url.substring(url.lastIndexOf('/') + 1))
        });
    if (fs.existsSync(filename)) {
        checkMD5(remix, filename, md5Sum, {
            correct: function() {
                active = active.filter(number => number !==
                    remix)
                return;
            },
            mismatch: function() {
                fs.unlinkSync(filename)
                downloadFile(remix, url, downloadFolder,
                    md5Sum)
            }
        })
    }
    if (!fs.existsSync(filename)) {
        downloadFile(remix, url, downloadFolder, md5Sum)
    }
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
let mainMenuTemplate = [{
    label: "File",
    submenu: [{
        label: "Sync",
        accelerator: "CommandOrControl+Y",
        click() {
            win.webContents.send("OCR:InitSync");
        },
        enabled: false
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

if (process.env.NODE_ENV === "development") {
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

ipcMain.on("OCR:EnableSyncMenu", function() {
    mainMenuTemplate[0].submenu[0].enabled = true;
    Menu.setApplicationMenu(Menu.buildFromTemplate(mainMenuTemplate));
});

ipcMain.on("OCR:DisableSyncMenu", function() {
    mainMenuTemplate[0].submenu[0].enabled = false;
    Menu.setApplicationMenu(Menu.buildFromTemplate(mainMenuTemplate));
});
