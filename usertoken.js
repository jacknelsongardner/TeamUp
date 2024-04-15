// Save JSON data to local storage
function saveData(username, email) {
    var userData = {
      username: username,
      email: email
    };

    // Convert the JSON object to a string
    var jsonString = JSON.stringify(userData);

    // Save the string to local storage
    localStorage.setItem('user_data', jsonString);

    alert('Data saved to local storage!');
  }

  // Get JSON data from local storage
  function getData() {
    if (testStorage())
    {
        // Retrieve the string from local storage
        var jsonString = localStorage.getItem('user_data');

        if (jsonString) {
            // Parse the string to get back the JSON object
            var userData = JSON.parse(jsonString);

            // Use the userData object as needed
            console.log(userData);
        } else {
            alert('No data found in local storage.');
        }
        }
  }

  // Test if the user has data in local storage
  function testStorage() {
    return localStorage.getItem('user_data') !== null;
  }   
