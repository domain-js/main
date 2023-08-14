const { Readable } = require("stream");

class TimeStream extends Readable {
  constructor(options) {
    super(options);
    this.count = 0;
    this.timer = setInterval(() => {
      this.push(new Date().toISOString() + "\n");
      this.count++;
      if (this.count === 5) {
        clearInterval(this.timer);
        this.push(null);
      }
    }, 1000);
  }

  _read(size) {}
}

const timeStream = new TimeStream();
timeStream.pipe(process.stdout);
