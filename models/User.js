const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      maxlength: [60, 'Name too long'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:   false,
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

// Return safe user object (no password)
userSchema.methods.toSafeObject = function () {
  return {
    id:        this._id,
    name:      this.name,
    email:     this.email,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

// Handle duplicate email error
userSchema.post('save', function (err, doc, next) {
  if (err.name === 'MongoServerError' && err.code === 11000) {
    next(new Error('An account with that email already exists.'));
  } else {
    next(err);
  }
});

module.exports = mongoose.model('User', userSchema);
