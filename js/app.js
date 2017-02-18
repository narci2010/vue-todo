class Form {
    constructor(data) {
        this.originalData = data;

        for (let field in data) {
            this[field] = data[field];
        }
    }

    reset() {
        for (let field in this.originalData) {
            if (field == 'date') {
                this[field] = moment().format('YYYY-MM-DD');
            } else if (field == 'time') {
                this[field] = moment().format('HH:mm');
            } else {
                this[field] = this.originalData[field];
            }
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

    update(index, status) {
        return new Promise(function (resolve, reject) {
            let objectStore = this.db.transaction([this.db_store_name], 'readwrite').objectStore(this.db_store_name);
            let request = objectStore.get(index);

            request.onsuccess = function (event) {
                let data = event.target.result;

                data.completed = status;

                let reqUpdate = objectStore.put(data);
                reqUpdate.onsuccess = function (event) {
                    resolve();
                }

                reqUpdate.onerror = function (event) {
                    reject(Error('Update error.'));
                }
            }

            request.onerror = function (event) {
                reject(Error('Update Request error.'));
            }
        }.bind(this));
    }
}

Vue.component('todo-item', {
    template: `
        <div class="todo-item">
            <div class="row align-items-center justify-content-between">
                <div class="col-6">
                    <p>
                        {{ todo.description }}
                    </p>
                    <div class="subline">
                        <strong>{{ todo.type | uppercase }}</strong>  &bull;  {{ todo.date }} {{ todo.time }}
                    </div>
                </div>
                <div class="col-6 text-right">
                    <i title="Mark as done" class="fa fa-angle-right btn-todo-done" v-if="!todo.completed" @click="$emit('done', todo.id)"></i>
                    <i title="Delete todo" class="fa fa-angle-right btn-todo-done" v-if="todo.completed" @click="$emit('delete', todo.id)"></i>
                </div>
            </div>
        </div>
    `,

    props: ['todo'],

    filters: {
        uppercase(value) {
            return value.toUpperCase();
        }
    },
});

var app = new Vue({
    el: '#todo-app',

    data: {
        form: new Form({
            id: '',
            type: 'work',
            description: '',
            completed: false,
            date: moment().format('YYYY-MM-DD'),
            time: moment().format('HH:mm')
        }),

        options: [
            { value: 'work', text: 'Work' },
            { value: 'private', text: 'Private' }
        ],

        iDB: new iDB('EventDB', 5, 'events'),

        todos: [],

        open: 0,
        done: 0,
        date: moment().format('dddd, MMM Do YYYY')
    },

    computed: {
        percent() {
            if (this.done === 0) return 5;
            return Math.round(this.done / (this.open + this.done) * 100);
        }
    },

    created() {
        if (!window.indexedDB) {
            alert("Your browser does not support IndexedDB.");
        }

        this.iDB.init()
            .then(function () {
                this.iDB.getAll()
                    .then(function (todos) {
                        this.todos = todos;
                        this.updateCount();
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
        addTodo() {
            let e = this.form.data();

            if (e.description.length < 5) {
                return false;
            }

            this.iDB.add(e)
                .then(function (index) {
                    e.id = index;
                    this.todos.push(e);
                    this.updateCount();
                    this.form.reset();
                }.bind(this))
                .catch(function (error) {
                    console.log(error);
                });
        },

        deleteTodo(index) {
            this.iDB.delete(index)
                .then(function () {
                    let i = this.todos.findIndex(function (elem) {
                        return elem.id === index;
                    });

                    this.todos.splice(i, 1);
                    this.updateCount();
                }.bind(this))
                .catch(function (error) {
                    console.log(error);
                });
        },

        setTodoDone(index) {
            this.updateTodo(index, true);
        },

        setTodoOpen(index) {
            this.updateTodo(index, false);
        },

        updateTodo(index, status) {
            this.iDB.update(index, status)
                .then(function () {
                    let i = this.todos.findIndex(function (elem) {
                        return elem.id === index;
                    });

                    this.todos[i].completed = status;
                    this.updateCount();
                }.bind(this))
                .catch(function (error) {
                    console.log(error);
                });
        },

        updateCount() {
            this.open = this.todos.filter(function (todo) {
                return todo.completed === false;
            }).length;

            this.done = this.todos.length - this.open;
        }
    }
});