import Contols from "./controls.js";
import Bluetooth from "./ble.js";

const controlsEl = document.getElementById("controls");

const controls = Contols(controlsEl);
controls.init();
