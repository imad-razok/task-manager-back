const mongoose = require("mongoose");
mongoose
  .connect("mongodb://localhost:27017/taskManager", { useNewUrlParser: true,useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to MongoDB seccessfuly :)");
  })
  .catch((e) => {
    console.log("Error while attempting connextion to mongodb database");
    console.log(e);
  });

mongoose.set("useCreateIndex", true);
mongoose.set("useFindAndModify", true);

module.exports = {
  mongoose,
};
