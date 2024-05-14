const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());

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

async function run() {
  try {
    const roomsCollection = client.db("ezBookingDB").collection("rooms");
    const bookingCollection = client.db("ezBookingDB").collection("bookings");
    const reviewCollection = client.db("ezBookingDB").collection("reviews");

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

    app.get('/rooms/:id/reviews', async (req, res) => {
      const id = req.params.id;
      const filter = { roomId: id };
      const pipeline = [
        {
          $match: filter
        },
        {
          $addFields:{
            postTimeDate:{$toDate:"$postTime"}
          }
        },
        {
          $sort:{
            postTimeDate:-1
          }
        }
      ]
      const result = await reviewCollection.aggregate(pipeline).toArray();
      res.send(result);
    })

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings", async (req, res) => {
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

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      console.log(review);
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.json(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Ez Booking is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
