const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const expressAsync = require("express-async-handler");

dotenv.config();

const app = express();

const dbConnect = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("MongoDb has connected successfully");
    } catch (err) {
        console.log(`Connection failed, ${err}`);
    }
}
dbConnect();

//configure session
app.use(session({
    secret: process.env.SESSION_KEY,  
    resave: false,
    saveUninitialized: true,
    store: new MongoStore({
        mongoUrl: "mongodb+srv://emma:BnN1hL9p04cnJjd2@book-directory-api.hgdveyq.mongodb.net/?retryWrites=true&w=majority",
        ttl: 24 * 60 * 60, //1 day
    })
}))

//configure express- middleware
app.use(express.json());

//user schema
const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    books: [
        {
            type: Object,
        }
    ]
},
    {
        timestamps: true
    });
//user model
const User = mongoose.model("User", userSchema);

//book schema
const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    isbn: {
        type: String,
        required: true
    },
    desc: {
        type: String,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
},
    {
        timestamps: true
    });
const Book = mongoose.model("Book", bookSchema);

//----------
//user
//----------

//register
app.post("/api/users/register", expressAsync(async (req, res) => {
    //check if a user is registered 
    const foundUser = await User.findOne({ email: req.body.email });
    if (foundUser) {
        throw new Error("User already exist");
    }
    //hash password
    const salt = await bcrypt.genSalt(10);
    const hashedpassword = await bcrypt.hash(req.body.password, salt)

    try {
        //user registration
        const user = await User.create({
            fullName: req.body.fullName,
            email: req.body.email,
            password: hashedpassword

        })
        res.json({
            // msg: "Register endpoint",
            message: "User Registered",
            user
        })
    } catch (error) {
        res.json(error)
    }
}))

//login
app.post("/api/users/login", expressAsync(async (req, res) => {
    try {
        //check if email exist
        const userFound = await User.findOne({ email: req.body.email })
        if (!userFound) {
            return res.status(404).json({
                message: "User email does not exist"
            })
        }
        //check if password is valid
        const isPasswordMatched = await bcrypt.compare(req.body.password, userFound.password);

        if (!isPasswordMatched) {
            return res.status(400).json({
                message: "Login credentials are invalid",
            });
        }

        //put the user into session
        req.session.authUser = userFound;


        res.json({
            msg: "Login success",
            userFound
        })
    } catch (error) {
        res.json(error);
    }
}))

//logout 
app.get("/api/users/logout", (req, res) => {
    req.session.destroy(() => {
        res.json("Logout successfully");
    })
})

//fetch users
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.json(error);
    }
})

//fetch single user
app.get("/api/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
        // res.json({
        //     msg: "Fetch user endpoint",
        // })
    } catch (error) {
        res.json(error);
    }
})

//user profile
app.get("/api/users/profile/:id", async (req, res) => {
    //check if user login
    if (!req.session.authUser) {
        return res.json("Access denied please login again");
    }
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (error) {
        res.json(error);
    }
})

//user update
app.put("/api/users/:id", async (req, res) => {
    try {
        res.json({
            msg: "Update user endpoint",
        })
    } catch (error) {
        res.json(error);
    }
})



//-----------
//book route
//-----------

//create book
app.post("/api/books", expressAsync(async (req, res) => {
    //check if user is login
    if (!req.session.authUser) {
        throw new Error("Please login before creating a book")
    }

    //check if title of book already exists
    const bookFound = await Book.findOne({ title: req.body.title });
    if (bookFound) {
        throw new Error(`This book with the title ${req.body.title} exists`);
    }
    try {
        const book = await Book.create({
            title: req.body.title,
            author: req.body.author,
            isbn: req.body.isbn,
            desc: req.body.desc,
            createdBy: req.session.authUser._id,
        });
        //find the user
        const user = await User.findById(req.session.authUser._id);
        //push the created book
        user.books.push(book);

        //save user again
        await user.save();
        res.json({
            message: "Book created",
            book,
        })
    } catch (error) {
        res.json(error);
    }
}))

//fetch all books
app.get("/api/books", expressAsync(async (req, res) => {
    try {
        const books = await Book.find().populate('createdBy');
        // res.json("Fetch all books endpoint")
        res.json(books);
    } catch (error) {
        res.json(error);
    }
}))

//fetch a single book
app.get("/api/books/:id", expressAsync(async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        res.json(book);
    } catch (error) {
        res.json(error);
    }
}))

//delete book
app.delete("/api/books/:id", expressAsync(async (req, res) => {
    try {
        await Book.findByIdAndDelete(req.params.id)
        res.json("Book deleted");
    } catch (error) {
        res.json(error);
    }
}))

//update book
app.put("/api/books/:id", expressAsync(async (req, res) => {
    try {
        const bookUpdated = await Book.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true //all fields are required to be updated
        });
        res.json(bookUpdated);
    } catch (error) {
        res.json(error);
    }
}))









//not found
const notFound = (req, res, next) => {
    const error = new Error("Not found");
    res.status(404)
    next(error);
}

//error handler middleware
const errorhandler = (err, req, res, next) => {
    res.json({
        message: err.message,
        stack: err.stack, //prints at which line error ocuurs
    });
};

app.use(notFound);
app.use(errorhandler);

//creating a server
app.listen(8000, (req, res) => {
    console.log("Server is up and running at port 8000")
})

//BnN1hL9p04cnJjd2
//mongodb+srv://emma:BnN1hL9p04cnJjd2@book-directory-api.hgdveyq.mongodb.net/?retryWrites=true&w=majority