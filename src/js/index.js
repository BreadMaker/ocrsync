const electron = require("electron");
const {
    ipcRenderer,
    shell
} = electron;

var template = String(),
    latestOCR = Number(),
    currentOCR = 3618;

$.fn.random = function() {
    return this.eq(Math.floor(Math.random() * this.length));
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

function checkSyncStatus() {
    $.get("http://ocremix.org/feeds/ten20/", function(data) {
        latestOCR = parseInt($(data).find("item:first link").text()
            .split("/")[4].replace("OCR", ""));
        $("#last").text(latestOCR);
        var OCRemixesToDownload = latestOCR - currentOCR;
        if (OCRemixesToDownload === 0) {
            $("#OCRStatus").html("SYNC");
        } else if (OCRemixesToDownload > 0) {
            $("#OCRStatus").html(
                "<i class='exclamation triangle icon'></i> Out of sync. " +
                OCRemixesToDownload + " missing.");
        } else {
            $("#OCRStatus").html("WEIRDERROR");
        }
    }).fail(function() {
        $("#OCRStatus").html(
            "<i class='exclamation icon'></i> Something weird happened"
        );
    });
}

/* jshint ignore:start */
async function startSync() {
    // for (var i = currentOCR; i < latestOCR; i++) {
    //     var OCRUrl = "http://ocremix.org/remix/OCR" + i.toString().padStart(
    //         5, "0");
    //     $.get(OCRUrl, function(data) {
    //         var html = $(data, document.implementation.createHTMLDocument(
    //             'virtual'));
    //         var titleInfo = $(".color-secondary:contains('ReMix')",
    //             html).parents("div:first");
    //         var remixTitle = getTextNodesIn($("h1", titleInfo)[0]);
    //         $("#OCRSyncProgressDetail").prepend(Mustache.render(
    //             template, {
    //                 remix: i,
    //                 thumb: data.split('og:image" content="')[1]
    //                     .split('"')[0].replace("ocremix.org",
    //                         "ocremix.org/thumbs/100"),
    //                 game: remixTitle[1].textContent,
    //                 title: remixTitle[2].textContent + " " + $(
    //                     "h2", titleInfo).text()
    //             }));
    //         ipcRenderer.send("OCR:URLReady", $("#modalDownload ul li a",
    //             html).random()[0].href);
    //     });
    //     await sleep(1000);
    // }
    // Envía una transferencia de prueba
    var i = 3618;
    $.get("http://ocremix.org/remix/OCR" + i.toString().padStart(5, "0"),
        function(data) {
            // DocumentFragment tries to load images :(
            var html = $(data, document.implementation.createHTMLDocument());
            var titleInfo = $(".color-secondary:contains('ReMix')",
                html).parents("div:first");
            var remixTitle = getTextNodesIn($("h1", titleInfo)[0]);
            $("#OCRSyncProgressDetail").prepend(Mustache.render(
                template, {
                    remix: i,
                    thumb: data.split('og:image" content="')[1]
                        .split('"')[0].replace("ocremix.org",
                            "ocremix.org/thumbs/100"),
                    game: remixTitle[1].textContent,
                    title: remixTitle[2].textContent + " " + $(
                        "h2", titleInfo).text()
                }));
            ipcRenderer.send("OCR:URLReady", i, $("#modalDownload ul li a",
                html).random()[0].href, localStorage.getItem("OCRDirectory"));
        });
    // La lógica antigua de python, rehecha en 15 líneas
    // for (i = currentOCR; i <= latestOCR; i++) {
    //     var OCRUrl = "http://ocremix.org/remix/OCR" + i
    //         .toString().padStart(5, "0");
    //     $.ajax({
    //         type: 'HEAD',
    //         url: OCRUrl,
    //         /* jshint ignore:start */
    //         complete: function(xhr) {
    //             console.log(xhr.getAllResponseHeaders());
    //             Aquí va el ćodigo usado en la transferencia de prueba
    //         },
    //         error: function() {
    //             console.error("ERROR fetching " +
    //                 OCRUrl);
    //         }
    //         /* jshint ignore:end */
    //     });
    // }
}
/* jshint ignore:end */

var triangleArray = [];

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

    var fps = 30;
    var now;
    var then = Date.now();
    var interval = 1000 / fps;
    var delta;

    function animate() {
        requestAnimationFrame(animate);
        now = Date.now();
        delta = now - then;

        if (delta > interval) {
            then = now - (delta % interval);
            render();
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

function backToMainScreen() {
    $("#OCRMainScreen").removeClass("showingSync");
}

function initSync() {
    if (localStorage.getItem("OCRDirectory") === null || localStorage.getItem(
            "OCRTorrentStrat") === null) {
        $("#OCRInitModal").modal({
            onApprove: function() {
                showConfig(true);
            }
        }).modal("show");
    } else {
        $(".modal").modal("hide");
        $("#OCRMainScreen").addClass("showingSync");
    }
}

$(document).ready(function() {
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
    var tempDownloadProgress = Number();
    ipcRenderer.on("OCR:DownloadProgress", function(e, progress, remix) {
        console.log(remix, progress);
        if (!(tempDownloadProgress === progress && progress ===
                1)) {
            $("#OCReMix-" + remix + " .progress").progress({
                percent: progress * 100,
                text: {
                    active: 'xxx MB/s',
                    success: 'Done!'
                }
            });
        }
        tempDownloadProgress = progress;
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
            localStorage.setItem("OCRDirectory", data[0]);
            $("#OCRDirectory").val(data[0]);
        }
    });
    $("#OCRCancelSyncButton").click(function(e) {
        e.preventDefault();
        backToMainScreen();
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
    if (localStorage.getItem("OCRTorrentStrat") !== null) {
        $("#OCRTorrentStrat").val(localStorage.getItem(
            "OCRTorrentStrat"));
    }
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
    $("#OCRTorrentStrat").dropdown({
        onChange: function(val) {
            localStorage.setItem("OCRTorrentStrat", val);
        }
    });
    checkSyncStatus();
});