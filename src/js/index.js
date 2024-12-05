import Contols from "./controls.js";
import Bluetooth from "./ble.js";

const controlsEl = document.getElementById("controls");

const controls = new Contols(controlsEl);
controls.init();
