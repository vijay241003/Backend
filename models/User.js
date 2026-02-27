/**
 * models/User.js
 * Mongoose schema for user accounts
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      maxlength: 100,
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
      type:      String,
      required:  [true, 'Password is required'],
      minlength: 8,
      select:    false,   // never returned in queries by default
    },
    lastLogin: {
      type:    Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
  }
);

// ── Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare plain password to hash
userSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Return clean object (no password, no __v)
userSchema.methods.toSafeObject = function () {
  return {
    id:        this._id,
    name:      this.name,
    email:     this.email,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

module.exports = mongoose.model('User', userSchema);
