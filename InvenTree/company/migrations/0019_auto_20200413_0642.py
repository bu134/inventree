# Generated by Django 2.2.10 on 2020-04-13 06:42

import os
from rapidfuzz import fuzz

from django.db import migrations, connection
from django.db.utils import OperationalError, ProgrammingError


def clear():
    os.system('cls' if os.name == 'nt' else 'clear')


def reverse_association(apps, schema_editor):
    """
    This is the 'reverse' operation of the manufacturer reversal.
    This operation is easier:

    For each SupplierPart object, copy the name of the 'manufacturer' field
    into the 'manufacturer_name' field.
    """

    cursor = connection.cursor()

    response = cursor.execute('select id, "MPN" from part_supplierpart;')
    supplier_parts = cursor.fetchall()

    # Exit if there are no SupplierPart objects
    # This crucial otherwise the unit test suite fails!
    if len(supplier_parts) == 0:
        return

    print("Reversing migration for manufacturer association")

    for (index, row) in enumerate(supplier_parts):
        supplier_part_id, MPN = row

        print(f"Checking SupplierPart [{supplier_part_id}]:")

        # Grab the manufacturer ID from the part
        response = cursor.execute(f"SELECT manufacturer_id FROM part_supplierpart WHERE id={supplier_part_id};")

        manufacturer_id = None

        row = cursor.fetchone()

        if len(row) > 0:
            try:
                manufacturer_id = int(row[0])
            except (TypeError, ValueError):
                pass

        if manufacturer_id is None:
            print(" - Manufacturer ID not set: Skipping")
            continue

        print(" - Manufacturer ID: [{id}]".format(id=manufacturer_id))

        # Now extract the "name" for the manufacturer
        response = cursor.execute(f"SELECT name from company_company where id={manufacturer_id};")
        
        row = cursor.fetchone()

        name = row[0]

        print(" - Manufacturer name: '{name}'".format(name=name))

        response = cursor.execute("UPDATE part_supplierpart SET manufacturer_name='{name}' WHERE id={ID};".format(name=name, ID=supplier_part_id))

def associate_manufacturers(apps, schema_editor):
    """
    This migration is the "middle step" in migration of the "manufacturer" field for the SupplierPart model.
    
    Previously the "manufacturer" field was a simple text field with the manufacturer name.
    This is quite insufficient.
    The new "manufacturer" field is a link to Company object which has the "is_manufacturer" parameter set to True

    This migration requires user interaction to create new "manufacturer" Company objects,
    based on the text value in the "manufacturer_name" field (which was created in the previous migration).

    It uses fuzzy pattern matching to help the user out as much as possible.
    """
    
    def get_manufacturer_name(part_id):
        """
        THIS IS CRITICAL!

        Once the pythonic representation of the model has removed the 'manufacturer_name' field,
        it is NOT ACCESSIBLE by calling SupplierPart.manufacturer_name.

        However, as long as the migrations are applied in order, then the table DOES have a field called 'manufacturer_name'.

        So, we just need to request it using dirty SQL.
        """

        query = "SELECT manufacturer_name from part_supplierpart where id={ID};".format(ID=part_id)

        cursor = connection.cursor()
        response = cursor.execute(query)
        row = cursor.fetchone()

        if len(row) > 0:
            return row[0]
        return ''

    cursor = connection.cursor()

    response = cursor.execute(f'select id, "MPN" from part_supplierpart;')
    supplier_parts = cursor.fetchall()

    # Exit if there are no SupplierPart objects
    # This crucial otherwise the unit test suite fails!
    if len(supplier_parts) == 0:
        return

    # Link a 'manufacturer_name' to a 'Company'
    links = {}

    # Map company names to company objects
    companies = {}

    # Iterate through each company object
    response = cursor.execute("select id, name from company_company;")
    results = cursor.fetchall()

    for index, row in enumerate(results):
        pk, name = row

        companies[name] = pk

    def link_part(part_id, name):
        """ Attempt to link Part to an existing Company """

        # Matches a company name directly
        if name in companies.keys():
            print(" - Part[{pk}]: '{n}' maps to existing manufacturer".format(pk=part_id, n=name))

            manufacturer_id = companies[name]

            query = f"update part_supplierpart set manufacturer_id={manufacturer_id} where id={part_id};"
            result = cursor.execute(query)

            return True

        # Have we already mapped this 
        if name in links.keys():
            print(" - Part[{pk}]: Mapped '{n}' - manufacturer <{c}>".format(pk=part_id, n=name, c=links[name]))

            manufacturer_id = links[name]

            query = f"update part_supplierpart set manufacturer_id={manufacturer_id} where id={part_id};"
            result = cursor.execute(query)
            return True

        # Mapping not possible
        return False

    def create_manufacturer(part_id, input_name, company_name):
        """ Create a new manufacturer """

        # Manually create a new database row
        # Note: Have to fill out all empty string values!
        new_manufacturer_query = f"insert into company_company (name, description, is_customer, is_supplier, is_manufacturer, address, website, phone, email, contact, link, notes) values ('{company_name}', '{company_name}', false, false, true, '', '', '', '', '', '', '');"

        cursor = connection.cursor()

        cursor.execute(new_manufacturer_query)

        # Extract the company back from the database
        response = cursor.execute(f"select id from company_company where name='{company_name}';")
        row = cursor.fetchone()
        manufacturer_id = int(row[0])

        # Map both names to the same company
        links[input_name] = manufacturer_id
        links[company_name] = manufacturer_id

        companies[company_name] = manufacturer_id
        
        print(" - Part[{pk}]: Created new manufacturer: '{name}'".format(pk=part_id, name=company_name))

        # Update SupplierPart object in the database
        cursor.execute(f"update part_supplierpart set manufacturer_id={manufacturer_id} where id={part_id};")

    def find_matches(text, threshold=65):
        """
        Attempt to match a 'name' to an existing Company.
        A list of potential matches will be returned.
        """

        matches = []

        for name in companies.keys():
            # Case-insensitive matching
            ratio = fuzz.partial_ratio(name.lower(), text.lower())

            if ratio > threshold:
                matches.append({'name': name, 'match': ratio})

        if len(matches) > 0:
            return [match['name'] for match in sorted(matches, key=lambda item: item['match'], reverse=True)]
        else:
            return []


    def map_part_to_manufacturer(part_id, idx, total):

        cursor = connection.cursor()

        name = get_manufacturer_name(part_id)

        # Skip empty names
        if not name or len(name) == 0:
            print(" - Part[{pk}]: No manufacturer_name provided, skipping".format(pk=part_id))
            return

        # Can be linked to an existing manufacturer
        if link_part(part_id, name):
            return

        # Find a list of potential matches
        matches = find_matches(name)

        clear()

        # Present a list of options
        print("----------------------------------")
        print("Checking part [{pk}] ({idx} of {total})".format(pk=part_id, idx=idx+1, total=total))
        print("Manufacturer name: '{n}'".format(n=name))
        print("----------------------------------")
        print("Select an option from the list below:")

        print("0) - Create new manufacturer '{n}'".format(n=name))
        print("")

        for i, m in enumerate(matches[:10]):
            print("{i}) - Use manufacturer '{opt}'".format(i=i+1, opt=m))

        print("")
        print("OR - Type a new custom manufacturer name")

        while True:
            response = str(input("> ")).strip()

            # Attempt to parse user response as an integer
            try:
                n = int(response)

                # Option 0) is to create a new manufacturer with the current name
                if n == 0:

                    create_manufacturer(part_id, name, name)
                    return

                # Options 1) - n) select an existing manufacturer
                else:
                    n = n - 1

                    if n < len(matches):
                        # Get the company which matches the selected options
                        company_name = matches[n]
                        company_id = companies[company_name]

                        # Ensure the company is designated as a manufacturer
                        cursor.execute(f"update company_company set is_manufacturer=true where id={company_id};")

                        # Link the company to the part
                        cursor.execute(f"update part_supplierpart set manufacturer_id={company_id} where id={part_id};")

                        # Link the name to the company
                        links[name] = company_id
                        links[company_name] = company_id

                        print(" - Part[{pk}]: Linked '{n}' to manufacturer '{m}'".format(pk=part_id, n=name, m=company_name))

                        return
                    else:
                        print("Please select a valid option")

            except ValueError:
                # User has typed in a custom name!

                if not response or len(response) == 0:
                    # Response cannot be empty!
                    print("Please select an option")
                
                # Double-check if the typed name corresponds to an existing item
                elif response in companies.keys():
                    link_part(part, companies[response])
                    return

                elif response in links.keys():
                    link_part(part, links[response])
                    return

                # No match, create a new manufacturer
                else:
                    create_manufacturer(part_id, name, response)
                    return

    clear()
    print("")
    clear()

    print("---------------------------------------")
    print("The SupplierPart model needs to be migrated,")
    print("as the new 'manufacturer' field maps to a 'Company' reference.")
    print("The existing 'manufacturer_name' field will be used to match")
    print("against possible companies.")
    print("This process requires user input.")
    print("")
    print("Note: This process MUST be completed to migrate the database.")
    print("---------------------------------------")
    print("")

    input("Press <ENTER> to continue.")

    clear()

    # Extract all SupplierPart objects from the database
    cursor = connection.cursor()
    response = cursor.execute('select id, "MPN", "SKU", manufacturer_id, manufacturer_name from part_supplierpart;')
    results = cursor.fetchall()

    part_count = len(results)
    
    # Create a unique set of manufacturer names
    for index, row in enumerate(results):
        pk, MPN, SKU, manufacturer_id, manufacturer_name = row

        if manufacturer_id is not None:
            print(f" - SupplierPart <{pk}> already has a manufacturer associated (skipping)")
            continue

        map_part_to_manufacturer(pk, index, part_count)

    print("Done!")

class Migration(migrations.Migration):

    dependencies = [
        ('company', '0018_supplierpart_manufacturer'),
    ]

    operations = [
        migrations.RunPython(associate_manufacturers, reverse_code=reverse_association)
    ]
