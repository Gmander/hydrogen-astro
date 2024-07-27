---
title: "Aviation Horses - Automating Instagram Posts with Selenium and MidJourney"
date: 2024-07-11T05:00:00Z
# image: /images/posts/post-2.jpg
image: /images/posts/developer_white_sweatshirt.png
categories:
   - Programming
   - Automation
   - Github
   - Project

draft: false
# draft: true
---

<!-- ## Aviation Horses - Automating Instagram Posts with Selenium and MidJourney -->

### Introduction

Have you ever wanted to automate your Instagram posts with unique, AI-generated images? Well, I recently worked on a project that does just that. The project involves two separate scripts: one for generating images using MidJourney and another for posting those images to Instagram. In this blog post, I'll walk you through the entire process, including practical examples and code snippets.

### Overview

The project is divided into two main scripts:

1. **Image Generating Script**: This script runs once a month to create 31 unique images using MidJourney via Discord.
2. **Instagram Posting Script**: This script runs every day at noon to post the generated images to Instagram.

### Image Generating Script

The image generating script accesses MidJourney through Discord using Selenium. It takes two parameters: `number_of_images` and `increment`. Here's a step-by-step breakdown:

#### Script Workflow

1. **Run a Selenium Web Driver**: Open Discord and log in.
2. **Find the MidJourney Chat**: Prompt image generation by typing the prompt and hitting enter.
3. **Upscale the First Image**: To get a single, higher resolution image.
4. **Download the Image**: Name it in a standardized, easily iterable way for later use.
5. **Store the Image**: Save it in a folder shared by the posting script.
6. **Loop and Run**: Repeat the process as many times as requested.

#### Code Example

Here's a simplified version of the image generating script:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import requests
import time
import os

DISCORD_EMAIL = os.getenv('DISCORD_EMAIL')
DISCORD_PASSWORD = os.getenv('DISCORD_PASSWORD')
MIDJOURNEY_PROMPT = 'aviation horse in the cockpit, flying the plane --style raw --ar 4:5'
DOWNLOAD_FOLDER = os.getenv('ROUTE_PATH') + '/images/unused'

driver = webdriver.Chrome()

def prompt_and_download_image(number_of_images, increment):
    for i in range(number_of_images):
        print(f"Downloading image {i+1}...")
        driver.get('https://discord.com/channels/@me/1087713153372127282')
        message_input = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Message @Midjourney Bot')]"))
        )
        input_field = driver.switch_to.active_element
        input_field.send_keys('/imagine ' + MIDJOURNEY_PROMPT)
        input_field.send_keys(Keys.RETURN)
        time.sleep(75)
        u1_buttons = driver.find_elements(By.XPATH, "//div[contains(text(), 'U1')]")
        if u1_buttons:
            u1_buttons[-1].click()
        time.sleep(5)
        images = driver.find_elements(By.TAG_NAME, 'img')
        if images:
            image_url = images[-15].get_attribute('src')
            response = requests.get(image_url)
            if response.status_code == 200:
                image_path = os.path.join(DOWNLOAD_FOLDER, 'image' + str(i + increment) + '.jpg')
                with open(image_path, 'wb') as file:
                    file.write(response.content)
                print(f"Image successfully downloaded: {image_path}")
            else:
                print(f"Failed to download image. Status code: {response.status_code}")

prompt_and_download_image(2, 0)
driver.quit()
```

### Instagram Posting Script

The Instagram posting script automates the process of logging in and uploading images. It takes two parameters: `image_path` and `caption`. Here’s a breakdown of the script:

#### Script Workflow

1. **Run a Selenium Web Driver**: Open Instagram and log in.
2. **Click 'New Post'**: Navigate through the necessary buttons.
3. **Upload the Image**: Select the image from the specified path.
4. **Enter Title (Caption)**: Type in the provided caption.
5. **Click 'Share'**: Post the image.
6. **Move the Used Image**: Transfer the used image to a different folder.

#### Code Example

Here's a simplified version of the Instagram posting script:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
import time

USERNAME = os.getenv('INSTA_USERNAME')
PASSWORD = os.getenv('INSTA_PASSWORD')

def post_to_instagram(image_path, caption):
    driver = webdriver.Chrome()
    driver.get('https://www.instagram.com/accounts/login/')
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(USERNAME)
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "password"))).send_keys(PASSWORD, Keys.RETURN)
    time.sleep(5)
    new_post_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, "svg[aria-label='New post']")))
    new_post_button.click()
    time.sleep(5)
    file_input = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, "//input[@type='file']")))
    file_input.send_keys(image_path)
    time.sleep(5)
    click_text_button(driver, 'Next')
    time.sleep(3)
    click_text_button(driver, 'Next')
    WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='Write a caption...']"))).send_keys(caption)
    click_text_button(driver, 'Share')
    time.sleep(5)
    driver.quit()

def click_text_button(driver, text):
    button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, f"//div[@role='button' and text()='{text}']")))
    button.click()

post_to_instagram('path/to/image.jpg', 'A fly horse!')
```

### Conclusion

Automating Instagram posts with unique images generated by MidJourney is both fun and practical. By leveraging Selenium, we can streamline the process and ensure consistency in our posts. I hope this guide inspires you to explore similar automation projects. Feel free to reach out if you have any questions or need further assistance!

Happy coding! 🚀

---

For further reading, check out the following links:
- [Selenium Documentation](https://www.selenium.dev/documentation/en/)
- [MidJourney API](https://midjourney.com/api/)
- Check out the [GitHub repository](https://github.com/Gmander/aviation-horses)

Let’s keep innovating and automating! 🌟
