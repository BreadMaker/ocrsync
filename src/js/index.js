const electron = require("electron");
const {
    ipcRenderer,
    shell
} = electron;

let template = String(),
    latestOCR = Number(),
    currentOCR = localStorage.getItem("OCRCurrent") === null ? 3617 :
    parseInt(localStorage.getItem("OCRCurrent")),
    filesSynced = 0,
    animationIsEnabled = true,
    now = Date(),
    db = new Dexie("OCRDB");

function getTextNodesIn(node, includeWhitespaceNodes) {
    var textNodes = [],
        nonWhitespaceMatcher = /\S/;

    function getTextNodes(node) {
        if (node.nodeType == 3) {
            if (includeWhitespaceNodes || nonWhitespaceMatcher.test(node.nodeValue)) {
                textNodes.push(node);
            }
        } else {
            for (var i = 0, len = node.childNodes.length; i < len; ++i) {
                getTextNodes(node.childNodes[i]);
            }
        }
    }

    getTextNodes(node);
    return textNodes;
}

function enableSyncIn30Seconds() {
    var timeLeft = (30000 - parseInt(new Date() - now)) / 1000;
    if (timeLeft > 0) {
        $("#OCRRetryTime").html(parseInt(timeLeft) + "<small>" + (timeLeft % 1)
            .toFixed(3).substring(1) + "</small>");
        requestAnimationFrame(enableSyncIn30Seconds);
    } else {
        $("#OCRRetryMessage").removeClass("muted text").html(
            "<a id='OCRRetry' href='#'>Check again?</a>");
    }
}

function updateSyncStatus() {
    var OCRemixesToDownload = latestOCR - currentOCR;
    if (OCRemixesToDownload === 0) {
        ipcRenderer.send("OCR:DisableSyncMenu");
        $("#OCRSyncButton").attr("disabled", "disabled");
        $("#OCRStatus").html(
            "<i class='icons'><i class='green check icon'></i><i class='corner sync icon'></i></i> Synchronized"
        );
        $("#OCRRetryMessage").html(
            "Please wait <span id='OCRRetryTime'></span>s to check again.");
        now = new Date();
        enableSyncIn30Seconds();
    } else if (OCRemixesToDownload > 0) {
        ipcRenderer.send("OCR:EnableSyncMenu");
        $("#OCRSyncButton").removeAttr("disabled");
        $("#OCRStatus").html(
            "<i class='exclamation triangle icon'></i> Out of sync. " +
            OCRemixesToDownload + " missing.");
    } else {
        ipcRenderer.send("OCR:DisableSyncMenu");
        $("#OCRSyncButton").attr("disabled", "disabled");
        $("#OCRStatus").html(
            "<i class='exclamation icon'></i> Something weird happened"
        );
        $("#OCRRetryMessage").html(
            "Please wait <span id='OCRRetryTime'></span>s to check again.");
        now = new Date();
        enableSyncIn30Seconds();
    }
}

function checkSyncStatus() {
    $.get("http://ocremix.org/feeds/ten20/", function(data) {
        latestOCR = parseInt($(data).find("item:first link").text()
            .split("/")[4].replace("OCR", ""));
        updateSyncStatus();
    }).fail(function() {
        $("#OCRStatus").html(
            "<i class='exclamation icon'></i> There was a problem trying to check sync status."
        );
        $("#OCRRetryMessage").html(
            "Please wait <span id='OCRRetryTime'></span>s to check again."
        );
        now = new Date();
        enableSyncIn30Seconds();
    });
}

function downloadOCReMix() {
    if (currentOCR < latestOCR) {
        currentOCR += 1;
        localStorage.setItem("OCRCurrent", currentOCR);
        db.remix.where({
            number: currentOCR
        }).first(item => {
            $("#OCRSyncProgressDetail").prepend(Mustache.render(
                template, item));
            ipcRenderer.send("OCR:URLReady", currentOCR, item.links,
                localStorage.getItem("OCRDirectory"), item.md5sum
            );
        }).catch(error => {
            $.get("http://ocremix.org/remix/OCR" + currentOCR.toString()
                .padStart(5, "0"),
                function(data) {
                    // DocumentFragment will try to load images :(
                    var html = $(data, document.implementation.createHTMLDocument()),
                        titleInfo = $(
                            ".color-secondary:contains('ReMix')",
                            html).parents("div:first"),
                        remixTitle = getTextNodesIn($("h1",
                            titleInfo)[0]),
                        remixObject = {
                            number: currentOCR,
                            thumb: data.split('og:image" content="')[
                                1].split('"')[0].replace(
                                "ocremix.org",
                                "ocremix.org/thumbs/100"),
                            game: remixTitle[1].textContent,
                            title: remixTitle[2].textContent + " " +
                                $("h2", titleInfo).text(),
                            links: Array(),
                            md5sum: $("dl dt:contains('MD5')", html)
                                .next("dd").text()
                        };
                    $("#modalDownload ul li a", html).each(function() {
                        if (!this.href.includes(
                                "iterations")) {
                            remixObject.links.push(this.href);
                        }
                    });
                    $("#OCRSyncProgressDetail").prepend(Mustache.render(
                        template, remixObject));
                    db.remix.put(remixObject);
                    ipcRenderer.send("OCR:URLReady", currentOCR,
                        remixObject.links,
                        localStorage.getItem("OCRDirectory"),
                        remixObject.md5sum);
                });
        });
    } else if (currentOCR === latestOCR) {
        $("#OCRSyncOverallStatus .header").text("Sync Complete");
        $("#OCRCancelSyncButton").hide();
        $("#OCRDoneSyncButton").show();
    }
}

let triangleArray = [];

function initCanvas() {
    $("#OCRLoadingScreen").remove();
    $("#OCRMainScreen").removeClass("transparent");
    var bgCanvas = document.getElementById("OCRBackgroundCanvas");
    var bgCanvasWidth = bgCanvas.width = window.innerWidth;
    var bgCanvasHeight = bgCanvas.height = window.innerHeight;
    var bgContext = bgCanvas.getContext("2d", {
        alpha: false
    });

    var fgCanvas = document.getElementById("OCRForegroundCanvas");

    fgCanvas.width = window.innerWidth;
    fgCanvas.height = window.innerHeight;

    var fgContext = fgCanvas.getContext("2d");

    function renderText() {
        // Title
        fgContext.font = "bold 48px \"Expletus Sans\"";
        fgContext.fillStyle = '#444';
        fgContext.textBaseline = 'middle';
        fgContext.textAlign = "center";
        fgContext.fillText("OCRSync", window.innerWidth / 2, 150);
    }

    renderText();

    var introCanvas = document.getElementById("OCRIntroCanvas");

    introCanvas.width = window.innerWidth;
    introCanvas.height = window.innerHeight;
    var introContext = introCanvas.getContext("2d");
    introContext.fillStyle = "white";
    introContext.fillRect(0, 0, window.innerWidth, window.innerHeight);

    function Triangle(x, y, status, up) {
        this.x = x;
        this.y = y;
        this.status = status;
        this.up = up;
        this.deltaLight = Math.random() < 0.5 ? rnd(0, 0.6) : rnd(0, -0.6);

        this.statusColor = function(status) {
            this.status = status;
            if (this.status === "error") {
                this.hue = 0;
                this.saturation = "100%";
                this.lightMin = 90;
                this.lightMax = 100;
            } else if (this.status === "warning") {
                this.hue = 60;
                this.saturation = "60%";
                this.lightMin = 60;
                this.lightMax = 100;
            } else {
                this.hue = Number();
                this.saturation = "0%";
                this.lightMin = 80;
                this.lightMax = 100;
            }
            this.lightness = rnd(this.lightMin, this.lightMax);
        };

        this.statusColor();

        this.draw = function() {
            bgContext.fillStyle = 'hsl(' + this.hue + ', ' + this.saturation +
                ', ' + this.lightness + '%)';
            if (this.up) {
                bgContext.beginPath();
                bgContext.moveTo(this.x, this.y);
                bgContext.lineTo(x + 20, this.y + 40);
                bgContext.lineTo(x - 20, this.y + 40);
                bgContext.closePath();
                bgContext.fill();
            } else {
                bgContext.beginPath();
                bgContext.moveTo(this.x, this.y);
                bgContext.lineTo(x + 40, this.y);
                bgContext.lineTo(x + 20, this.y + 40);
                bgContext.closePath();
                bgContext.fill();
            }
        };

        this.update = function() {
            this.lightness += this.deltaLight;
            if (this.lightness > this.lightMax || this.lightness < this.lightMin) {
                this.deltaLight *= -1;
            }
            this.draw();
        };
    }

    function rnd(min, max) {
        return Math.floor((Math.random() * (max - min + 1)) + min);
    }

    function triangleBase(status) {
        var columns = Math.ceil(bgCanvasWidth / 40) + 1;
        var rows = Math.ceil(bgCanvasHeight / 40);

        var col, row;
        for (row = 0; row < rows; row++) {
            for (col = 0; col < columns; col++) {
                var x = col * 40;
                var y = row * 40;

                if (row % 2 != 0) {
                    x -= 20;
                }
                triangleArray.push(new Triangle(x, y, status, true));
                triangleArray.push(new Triangle(x, y, status, false));
            }
        }
    }

    function render() {
        for (var i = 0; i < triangleArray.length; i++) {
            triangleArray[i].update();
        }
    }

    let fps = 15,
        now, then = Date.now(),
        interval = 1000 / fps,
        delta;

    function animate() {
        if (animationIsEnabled) {
            requestAnimationFrame(animate);
            now = Date.now();
            delta = now - then;
            if (delta > interval) {
                then = now - (delta % interval);
                render();
            }
        }
    }

    triangleBase();
    animate();

    var introOpacity = 100;

    function introAnimate() {
        introContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
        introContext.globalAlpha = introOpacity / 100;
        introContext.fillStyle = "white";
        introContext.fillRect(0, 0, window.innerWidth, window.innerHeight);
        if (introOpacity >= 0) {
            requestAnimationFrame(introAnimate);
        } else {
            $("#OCRIntroCanvas").remove();
            $("#OCRSyncScreen").removeClass("transparent");
        }
        introOpacity -= 2;
    }

    introAnimate();

    function runGoBackAnimation() {
        animationIsEnabled = true;
        $("#OCRMainScreen").removeClass("showingSync").one(
            "transitionend",
            function() {
                $("#OCRSyncProgressDetail").empty();
                animate();
            });
    }

    $("#OCRCancelSyncButton button").click(function(e) {
        e.preventDefault();
        currentOCR -= 1;
        localStorage.setItem("OCRCurrent", currentOCR);
        ipcRenderer.send("OCR:StopSync");
        runGoBackAnimation();
    });

    $("#OCRDoneSyncButton button").click(function(e) {
        e.preventDefault();
        runGoBackAnimation();
    });

    $(window).resize(function() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
        fgContext.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
        fgCanvas.width = window.innerWidth;
        fgCanvas.height = window.innerHeight;
        renderText();
    });
}

function showConfig(goingToSync) {
    $("#OCRConfigModal").modal({
        onApprove: function() {
            if (goingToSync) {
                initSync();
            }
        }
    }).modal("show");
}

function initSync() {
    if (localStorage.getItem("OCRDirectory") === null
        /* || localStorage.getItem(
                    "OCRTorrentStrat") === null*/
    ) {
        $("#OCRInitModal").modal({
            onApprove: function() {
                showConfig(true);
            }
        }).modal("show");
    } else {
        $(".modal").modal("hide");
        animationIsEnabled = false;
        $("#OCRMainScreen").addClass("showingSync");
        $("#OCRSyncOverallProgress .progress").progress({
            label: 'ratio',
            total: latestOCR - currentOCR
        });
        downloadOCReMix();
    }
}

function moveFiles(orig, dest) {
    // SHOW MODAL, SHOW PREPARING MESSAGE
    db.remix.orderBy("filename").keys(function(filenames) {
        ipcRenderer.send("OCR:MoveFiles", orig, dest, filenames);
    });
}

$(document).ready(function() {
    db.version(1).stores({
        remix: 'number,thumb,game,title,links,filename,md5sum'
    });
    db.open();
    // Initialize template
    template = $("#OCRItemTemplate").html();
    // Initialize modals
    $(".ui.modal").modal();
    // Enable tooltips
    $("#OCRConfigModal .help").each(function() {
        $(this).popup({
            target: $(this).find(".target")
        });
    });
    document.fonts.ready.then(function() {
        if (document.fonts.check('1em \"Expletus Sans\"')) {
            $("body").removeClass("expletus");
            initCanvas();
        }
    });
    ipcRenderer.on("OCR:DownloadProgress", function(e, progress, remix) {
        $("#OCReMix-" + remix + " .progress").progress({
            percent: progress * 100
        }).progress("set label", "Downloading");
    });
    ipcRenderer.on("OCR:MD5Check", function(e, remix, filename, status) {
        switch (status) {
            case "start":
                $("#OCReMix-" + remix + " .progress").progress(
                    "set label", "Checking Download");
                break;
            case "correct":
                $("#OCReMix-" + remix + " .progress").progress(
                    "set percent", 100).progress(
                    "set label", "Download Completed!");
                $("#OCRSyncOverallProgress .progress").progress(
                    "set progress", filesSynced += 1);
                db.remix.update(remix, {
                    "filename": filename
                });
                updateSyncStatus();
                downloadOCReMix();
                break;
            case "mismatch":
                $("#OCReMix-" + remix + " .progress").addClass(
                        "warning").progress("set percent", 100)
                    .progress("set label",
                        "Warning: MD5 Mismatch");
                $("#OCRSyncOverallProgress .progress").progress(
                    "set progress", filesSynced += 1);
                db.remix.update(remix, {
                    "filename": filename
                });
                updateSyncStatus();
                downloadOCReMix();
                break;
        }
    });
    $("#OCRConfigButton").click(function() {
        showConfig(false);
    });
    ipcRenderer.on("OCR:ShowConfig", function() {
        showConfig(false);
    });
    $("#OCRSelectDirectoryButton").click(function(e) {
        e.preventDefault();
        ipcRenderer.send("OCR:SelectDirectory");
    });
    ipcRenderer.on("OCR:DirectorySelected", function(e, data) {
        if (data !== null) {
            if (localStorage.getItem("OCRDirectory") !== null) {
                moveFiles(localStorage.getItem("OCRDirectory"),
                    data[0]);
            }
            localStorage.setItem("OCRDirectory", data[0]);
            $("#OCRDirectory").val(data[0]);
        }
    });
    $("#OCRAboutButton").click(function() {
        $("#OCRAboutModal").modal("show");
    });
    ipcRenderer.on("OCR:ShowAbout", function() {
        $("#OCRAboutModal").modal("show");
    });
    $("#OCRSyncButton").click(function(e) {
        e.preventDefault();
        initSync();
    });
    ipcRenderer.on("OCR:InitSync", function() {
        initSync();
    });
    // Setting configuration parameters
    if (localStorage.getItem("OCRDirectory") !== null) {
        $("#OCRDirectory").val(localStorage.getItem("OCRDirectory"));
    }
    // if (localStorage.getItem("OCRTorrentStrat") !== null) {
    //     $("#OCRTorrentStrat").val(localStorage.getItem(
    //         "OCRTorrentStrat"));
    // }
    // Showing copyright year
    $(".current.year").text(new Date().getFullYear());
    // Capturing all links and launching default browser instead
    $("a").click(function(e) {
        e.preventDefault();
        shell.openExternal($(this).attr("href"));
    });
    $("#OCRCreditsButton").state({
        text: {
            inactive: 'Credits',
            active: 'About'
        }
    }).click(function() {
        $('.shape').shape("flip back");
    });
    // $("#OCRTorrentStrat").dropdown({
    //     onChange: function(val) {
    //         localStorage.setItem("OCRTorrentStrat", val);
    //     }
    // });
    $("body").on("click", "#OCRRetry", function(e) {
        e.preventDefault();
        $("#OCRRetryMessage").empty().addClass("muted text");
        $("#OCRStatus").html(
            "<i class='asterisk loading icon'></i> Connecting&hellip;"
        );
        checkSyncStatus();
    });
    checkSyncStatus();
});
