import Contols from "./controls.js";
import Bluetooth from "./bluetooth.js";

const controlsEl = document.getElementById("controls");

const controls = Contols(controlsEl);
controls.init();
