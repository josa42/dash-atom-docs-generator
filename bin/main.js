#!/usr/bin/env node

var fs = require('fs'),
    sqlite3 = require('sqlite3'),
    mkdirp = require('mkdirp'),
    config = require('./lib/config'),
    searchIndex = require('./lib/search_index'),
    db;

mkdirp.sync('Atom.docset/Contents/Resources/Documents');

db = new sqlite3.Database(config.dbfile, function(err) {
    if (err) {
        console.error('Error opening database ' + config.dbfile, err.code);
        process.exit();
    }
});

searchIndex(function(index) {

    db.serialize(function() {
        db.run('DROP TABLE IF EXISTS searchIndex');
        db.run('CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT)');
        db.run('CREATE UNIQUE INDEX anchor ON searchIndex(name, type, path)');

        var stmt = db.prepare('INSERT INTO searchIndex(name, type, path) VALUES (?, ?, ?)');

        index.forEach(function(item) {
            stmt.run(item.name, item.type, item.path);
        });

        stmt.finalize();
    });

    db.close();

    config.files.forEach(function(file) {
        fs.createReadStream(file.name).pipe(fs.createWriteStream(file.dest));
    });
});
