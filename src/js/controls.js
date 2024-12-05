import Message from "./message.js";

export default class Controls {
  constructor(el) {
    this.el = el;
  }

  init() {
    this.el.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
    });
    this.el.preset.addEventListener("change", (event) => {
      this.el.submit();
    });
  }
}
