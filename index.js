const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

require("dotenv").config();
const port = process.env.PORT || 15000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
	const authorization = req.headers.authorization;
	if (!authorization) {
		return res.status(401).send({ error: true, message: "Invalid authorization" });
	}

	const token = authorization.split(" ")[1];

	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			return res.status(401).send({ error: true, message: "Invalid authorization" });
		}

		req.decoded = decoded;
		next();
	});
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `${process.env.Mongo_URI}`;

const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// await client.connect();

		const usersCollection = client.db("go-home").collection("users");
		const houseCollection = client.db("go-home").collection("houses");
		const bookedCollection = client.db("go-home").collection("booked");

		/* ------------------------------ users -------------------------------- */
		app.post("/users", async (req, res) => {
			const { name, userName, image, role, email, password } = req.body;

			const existingUser = await usersCollection.findOne({
				email: email,
			});

			if (existingUser) {
				return res.status(400).send({ message: "User already exists" });
			}

			const saltRounds = 10;
			bcrypt.hash(password, saltRounds, async (err, hash) => {
				if (err) {
					return res.status(500).send({ message: "Password hashing error" });
				}

				const newUser = {
					name,
					userName,
					image,
					role,
					email,
					password: hash,
					createdAt: new Date(),
				};

				const result = await usersCollection.insertOne(newUser);
				res.send(result);
			});
		});

		app.post("/users/login", async (req, res) => {
			const { email, password } = req.body;

			const user = await usersCollection.findOne({ email: email });

			if (!user) {
				res.status(401).send({ message: "Login failed" });
			} else {
				bcrypt.compare(password, user.password, async (err, passwordMatch) => {
					if (err || !passwordMatch) {
						res.status(401).send({ message: "Login failed" });
					} else {
						const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
							expiresIn: "30d",
						});
						res.send({ token });
					}
				});
			}
		});

		app.get("/users", async (req, res) => {
			let query = {};

			if (req.query?.name) {
				query.name = {
					$regex: req.query.name,
					$options: "i",
				};
			}

			const result = await usersCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/users/:userName", async (req, res) => {
			const username = req.params.userName;

			const query = { userName: username };

			const result = await usersCollection.findOne(query);

			res.send(result);
		});

		app.delete("/users/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await usersCollection.deleteOne(query);
			res.send(result);
		});

		/* ------------------------------ houses-------------------------------- */
		app.post("/houses", async (req, res) => {
			const post = req.body;
			post.createdAt = new Date();
			const result = await houseCollection.insertOne(post);
			res.send(result);
		});

		app.get("/houses", async (req, res) => {
			let query = {};

			if (req.query?.houseName) {
				query.houseName = {
					$regex: req.query.houseName,
					$options: "i",
				};
			}

			if (req.query?.city) {
				query.city = {
					$regex: req.query.city,
					$options: "i",
				};
			}
			const result = await houseCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/houses/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await houseCollection.findOne(query);
			res.send(result);
		});

		app.put("/houses/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const options = { upsert: true };

			const updateHouse = req.body;
			const houseEdit = {
				$set: {
					houseName: updateHouse.houseName,
					address: updateHouse.address,
					city: updateHouse.city,
					bedrooms: updateHouse.bedrooms,
					bathrooms: updateHouse.bathrooms,
					roomSize: updateHouse.roomSize,
					availability: updateHouse.availability,
					rent: updateHouse.rent,
					phone: updateHouse.phone,
					description: updateHouse.description,
				},
			};

			const result = await houseCollection.updateOne(filter, houseEdit, options);
			res.send(result);
		});

		app.delete("/houses/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await houseCollection.deleteOne(query);
			res.send(result);
		});

		/* ------------------------------ booked-------------------------------- */
		app.post("/booked", async (req, res) => {
			const post = req.body;
			const bookerId = post.bookerId;

			const userBookings = await bookedCollection.find({ bookerId }).toArray();

			if (userBookings.length >= 2) {
				res.status(400).send({
					error: "You have already booked 2 rooms. You cannot book any more rooms.",
				});
			} else {
				post.bookedAt = new Date();
				const result = await bookedCollection.insertOne(post);
				res.send(result);
			}
		});

		app.get("/booked", async (req, res) => {
			const result = await bookedCollection.find().toArray();
			res.send(result);
		});

		app.get("/booked/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await bookedCollection.findOne(query);
			res.send(result);
		});

		app.delete("/booked/:id", async (req, res) => {
			const id = req.params.id;
			console.log("id: ", id);
			const query = {
				bookmark: id,
			};
			const result = await bookedCollection.deleteOne(query);
			res.send(result);
		});

		await client.db("admin").command({ ping: 1 });
		console.log("Pinged your deployment. You successfully connected to MongoDB!");
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("go-home server is running");
});

app.listen(port, () => {
	console.log(`server is running at port: ${port}`);
});
