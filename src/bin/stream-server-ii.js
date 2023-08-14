const restify = require("restify");

const server = restify.createServer();

server.get("/stream", (req, res, next) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // res.flushHeaders(); // 确保立即发送响应头

  let count = 0;

  const sendData = () => {
    res.write(`data: ${new Date().toISOString()}\n\n`);
    count++;

    if (count < 5) {
      setTimeout(sendData, 1000);
    } else {
      res.end();
    }
  };

  sendData();

  req.on("close", () => {
    clearTimeout(sendData);
  });
});

server.listen(8080, () => {
  console.log("Server is running at http://localhost:8080");
});
