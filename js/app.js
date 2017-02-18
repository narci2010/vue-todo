class Form {
    constructor(data) {
        this.originalData = data;

        for (let field in data) {
            this[field] = data[field];
        }
    }

    reset() {
        for (let field in this.originalData) {
            this[field] = '';
        }
    }

    data() {
        let data = Object.assign({}, this);

        delete data.originalData;

        return data;
    }
}

class iDB {
    constructor(name, version, store_name) {
        this.db;

        this.db_name = name;
        this.db_version = version;
        this.db_store_name = store_name;
    }

    init() {
        return new Promise(function (resolve, reject) {
            console.log('init');
            let request = window.indexedDB.open(this.db_name, this.db_version);

            request.onerror = function (event) {
                reject(Error('Not allowed to use IndexedDB.'));
            };

            request.onupgradeneeded = function (event) {
                let db = event.target.result;
                let osEvents = db.createObjectStore(this.db_store_name, { autoIncrement: true });

                osEvents.createIndex('name', 'name', { unique: false });

                osEvents.transaction.oncomplete = function (event) {
                    console.log('DB successfully initialized.');
                };

            }.bind(this);

            request.onsuccess = function (event) {
                this.db = event.target.result;

                resolve();

            }.bind(this);
        }.bind(this));
    }

    getAll() {
        return new Promise(function (resolve, reject) {
            let allEvents = [];

            let objectStore = this.db.transaction([this.db_store_name], 'readonly')
                .objectStore(this.db_store_name);

            objectStore.openCursor().onsuccess = function (event) {
                let cursor = event.target.result;
                if (cursor) {
                    let event = {};

                    event = cursor.value;
                    event.id = cursor.key;

                    allEvents.push(event);

                    cursor.continue();
                } else {
                    resolve(allEvents);
                }
            };
        }.bind(this));
    }

    add(data) {
        return new Promise(function (resolve, reject) {
            let transaction = this.db.transaction([this.db_store_name], 'readwrite');

            transaction.oncomplete = function (event) {
                console.log('Transaction successful.');
            }

            transaction.onerror = function (event) {
                reject(Error("Transaction error."));
            }

            let osEvents = transaction.objectStore(this.db_store_name);
            let request = osEvents.add(data);

            request.onsuccess = function (event) {
                console.log('Data added');
                resolve(event.target.result);
            }

            request.onerror = function (event) {
                reject(Error("Request error."));
            }
        }.bind(this));
    }

    delete(index) {
        return new Promise(function (resolve, reject) {
            let request = this.db.transaction([this.db_store_name], 'readwrite')
                .objectStore(this.db_store_name)
                .delete(index);

            request.onsuccess = function (event) {
                console.log('Data deleted.');
                console.log(event.target.result);
                resolve();
            }

            request.onerror = function (event) {
                reject(Error('Request error.'));
            }
        }.bind(this));
    }
}

var app = new Vue({
    el: '#todo-app',

    data: {
        form: new Form({
            id: '',
            name: '',
            description: '',
            date: ''
        }),

        iDB: new iDB('EventDB', 5, 'events'),

        events: [],

        open: 0,
        closed: 0,
        date: moment().format('dddd, MMM Do YYYY')
    },

    created() {
        if (!window.indexedDB) {
            alert("Your browser does not support IndexedDB.");
        }

        this.iDB.init()
            .then(function () {
                this.iDB.getAll()
                    .then(function (events) {
                        this.events = events;
                    }.bind(this))
                    .catch(function (error) {
                        console.log(error);
                    });
            }.bind(this))
            .catch(function (error) {
                console.log(error);
            });
    },

    methods: {
        addEvent() {
            let e = this.form.data();
            this.iDB.add(e)
                .then(function (index) {
                    e.id = index;
                    this.events.push(e);
                    this.form.reset();
                }.bind(this))
                .catch(function (error) {
                    console.log(error);
                });
        },

        deleteEvent(index) {
            this.iDB.delete(index)
                .then(function () {
                    let i = this.events.findIndex(function (elem) {
                        return elem.id === index;
                    });

                    this.events.splice(i, 1);
                }.bind(this))
                .catch(function (error) {
                    console.log(error);
                });
        }
    }
});