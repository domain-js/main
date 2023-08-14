const restify = require("restify");

const server = restify.createServer();

server.get("/stream", (req, res, next) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let count = 0;
  const timer = setInterval(() => {
    res.write(`data: ${new Date().toISOString()}\n\n`);
    count++;
    if (count === 5) {
      clearInterval(timer);
      res.end();
    }
  }, 1000);

  req.on("close", () => {
    clearInterval(timer);
  });
});

server.listen(8080, () => {
  console.log("Server is running at http://localhost:8080");
});
