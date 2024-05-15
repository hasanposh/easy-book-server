const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://ez-book-client.web.app",
      "https://ez-book-client.firebaseapp.com"
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
// console.log(process.env.DB_USER);
// console.log(process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tlu13v2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = async (req, res, next) => {
  console.log("called:", req.method, req.url, req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const coockieOption = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  secure: process.env.NODE_ENV === "production" ? true : false,
};

async function run() {
  try {
    const roomsCollection = client.db("ezBookingDB").collection("rooms");
    const bookingCollection = client.db("ezBookingDB").collection("bookings");
    const reviewCollection = client.db("ezBookingDB").collection("reviews");

    // auth related api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.cookie("token", token, coockieOption).send({ success: true });
    });

    app.post("/logout", logger, async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...coockieOption, maxAge: 0 })
        .send({ success: true });
    });

    app.get("/rooms", async (req, res) => {
      const { sortBy } = req.query;
      let sortOptions = {};

      if (sortBy === "price_asc") {
        sortOptions = { price_per_night: 1 };
      } else if (sortBy === "price_desc") {
        sortOptions = { price_per_night: -1 };
      }

      const cursor = roomsCollection.find().sort(sortOptions);
      const result = await cursor.toArray();
      res.json(result);
    });

    // app.get("/rooms", async (req, res) => {
    //   const cursor = roomsCollection.find();
    //   const result = await cursor.toArray();
    //   res.json(result);
    // })

    app.get("/rooms/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });

    app.put("/rooms/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateAvailability = req.body;
        // console.log(1);
        const updateDoc = {
          $set: {
            availability: updateAvailability.availability,
          },
        };
        // console.log(2)
        const result = await roomsCollection.updateOne(filter, updateDoc);
        // res.send(result);
        if (result.modifiedCount === 1) {
          res
            .status(200)
            .json({ message: "Room availability updated successfully" });
        } else {
          res
            .status(404)
            .json({ message: "Room not found or availability not updated" });
        }
      } catch (error) {
        console.error("Error updating room availability:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings", verifyToken, async (req, res) => {
      // console.log(req.query.email);
      let query = {};
      if (req.query?.email) {
        query = { userMail: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedFormattedUDate = req.body;
      console.log(updatedFormattedUDate);
      const updateDoc = {
        $set: {
          formattedDate: updatedFormattedUDate.updatedFormattedUDate,
        },
      };

      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/rooms/:id/reviews", async (req, res) => {
      const id = req.params.id;
      const filter = { roomId: id };
      const pipeline = [
        {
          $match: filter,
        },
        {
          $addFields: {
            postTimeDate: { $toDate: "$postTime" },
          },
        },
        {
          $sort: {
            postTimeDate: -1,
          },
        },
      ];
      const result = await reviewCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      console.log(review);
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.get("/allReviews", async (req, res) => {
      const pipeline = [
        {
          $addFields: {
            postTimeDate: { $toDate: "$postTime" },
          },
        },
        {
          $sort: {
            postTimeDate: +1,
          },
        },
      ];
      // const cursor = reviewCollection.find();
      const result = await reviewCollection.aggregate(pipeline).toArray();
      // const cursor = reviewCollection.find();
      // const result = await cursor.toArray();
      res.json(result);
    });

    app.get("/", (req, res) => {
      res.send("Ez Booking is running");
    });


    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


run()
  .then(() => {
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
})
.catch(console.error);