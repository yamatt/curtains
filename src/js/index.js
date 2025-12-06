import Controls from "./controls.js";
import Bluetooth from "./ble.js";

const controlsEl = document.getElementById("controls");

const controls = new Controls(controlsEl);
controls.init();
