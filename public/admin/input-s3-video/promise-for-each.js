function forEachPromise (array, iterator) {
  return new Promise(function (resolve, reject) {
    var completed = 0;
    var total = array.length;

    var complete = function () {
      if (completed === total) {
        resolve();
        return;
      }
      iterate();
      completed += 1;
    };
    
    var iterate = function () {
      iterator(array[completed])
        .then(complete)
        .catch(reject);
    };

    complete();
  });
}